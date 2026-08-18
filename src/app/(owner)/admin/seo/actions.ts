"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { safeAction, type ActionResult } from "@/lib/safe-action";
import { storage, normalizeKey } from "@/lib/storage";
import { revalidateSeoSettings, SEO_SETTINGS_ID } from "@/lib/seo/settings";
import { normalizePath } from "@/lib/seo/redirects";
import {
  analyzeCannibalization,
  keywordClusters,
  keywordMatch,
  type CannibalReport,
  type ClusterReport,
} from "@/lib/seo/semantic";
import {
  generateMeta,
  scoreMeta,
  draftStaticPageText,
  type MetaSuggestion,
  type MetaScore,
} from "@/lib/seo/ai";
import { getSeoSettings } from "@/lib/seo/settings";
import {
  STATIC_PAGES,
  isKnownStaticPage,
  revalidateStaticPageSeo,
} from "@/lib/seo/static-pages";
import { isKnownScope, isOverridableScope } from "@/lib/seo/scope";
import { env } from "@/env";

/** Пустая строка → null (единый способ «очистить» опциональное поле). */
const optStr = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

/** Ссылка WhatsApp (wa.me / api.whatsapp.com). Вне экспорта — ограничение "use server". */
const waLinkSchema = z
  .string()
  .trim()
  .min(1, "Укажите ссылку WhatsApp")
  .max(300)
  .refine(
    (v) => v.startsWith("https://wa.me/") || v.startsWith("https://api.whatsapp.com/"),
    { message: "Ожидается ссылка вида https://wa.me/375…" },
  );

/**
 * Сохранение глобальных SEO-настроек (singleton). Только OWNER.
 * Меняет метаданные/счётчики/подтверждения прав без деплоя; сбрасывает кэш layout.
 */
export const updateSeoSettingsAction = safeAction(
  {
    schema: z.object({
      titleTemplate: z.string().trim().min(1, "Укажите шаблон title").max(120),
      defaultTitle: z.string().trim().min(1, "Укажите заголовок").max(120),
      defaultDescription: z.string().trim().min(1, "Укажите описание").max(320),
      socialInstagram: optStr(300),
      socialTelegram: optStr(300),
      socialYoutube: optStr(300),
      socialTiktok: optStr(300),
      socialFacebook: optStr(300),
      socialLinkedin: optStr(300),
      socialVk: optStr(300),
      // Оценка вводится вручную (у карт нет бесплатного API); 0 = «не показывать».
      yandexMapsUrl: optStr(500),
      yandexRating: z.number().min(0).max(5).nullable(),
      yandexReviews: z.number().int().min(0).max(100_000).nullable(),
      googleMapsUrl: optStr(500),
      googleRating: z.number().min(0).max(5).nullable(),
      googleReviews: z.number().int().min(0).max(100_000).nullable(),
      googleVerification: optStr(200),
      yandexVerification: optStr(200),
      ga4Id: optStr(40),
      yandexMetricaId: optStr(40),
      orgName: z.string().trim().min(1, "Укажите название организации").max(120),
      orgDescription: optStr(300),
      orgPhone: z.string().trim().min(1, "Укажите телефон").max(40),
      orgCountry: z.string().trim().min(1, "Укажите страну").max(60),
      supportWhatsapp: waLinkSchema,
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    await db.seoSettings.upsert({
      where: { id: SEO_SETTINGS_ID },
      create: { id: SEO_SETTINGS_ID, ...input },
      update: input,
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.settings.update",
      meta: {
        ga4: Boolean(input.ga4Id),
        metrica: Boolean(input.yandexMetricaId),
      },
    });

    revalidateSeoSettings();
    return { ok: true as const };
  },
);

/**
 * AI-черновик title/description из исходного текста (Anthropic Haiku).
 * Возвращает предложение — владелец правит и сохраняет отдельным действием.
 */
export async function generateMetaAction(
  raw: unknown,
): Promise<ActionResult<MetaSuggestion>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }

  const parsed = z
    .object({
      source: z.string().trim().min(1, "Нет исходного текста").max(6000),
      focusKeyword: z.string().trim().max(120).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Заполните исходный текст" };
  }

  try {
    const suggestion = await generateMeta(parsed.data.source, {
      focusKeyword: parsed.data.focusKeyword,
      userId: session.user.id,
    });
    return { ok: true, data: suggestion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка AI" };
  }
}

/**
 * AI-оценка качества title/description (0..100) + проблемы и рекомендации.
 * Информационный сигнал; переиспользуется формой курса и глобальными настройками.
 */
export async function scoreMetaAction(
  raw: unknown,
): Promise<ActionResult<MetaScore>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }

  const parsed = z
    .object({
      title: z.string().trim().max(200),
      description: z.string().trim().max(400),
      focusKeyword: z.string().trim().max(120).optional(),
      source: z.string().trim().max(6000).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Некорректные данные" };
  }
  if (!parsed.data.title && !parsed.data.description) {
    return { ok: false, error: "Заполните заголовок или описание" };
  }

  try {
    const result = await scoreMeta(parsed.data, { userId: session.user.id });
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка AI" };
  }
}

// ─────────────────────────── Редиректы (P2) ───────────────────────────

/**
 * Схлопнуть цепочку: если `to` сам редиректится дальше, вернуть конечное назначение
 * (резолвер в приложении делает один прыжок — цепочки теряли бы позиции). Бросает при
 * цикле (цепочка возвращается в `from`) и при подозрительно длинной цепочке.
 */
async function flattenRedirectTarget(
  from: string,
  to: string,
  excludeId?: string,
): Promise<string> {
  if (to.startsWith("http")) return to;

  const all = await db.redirect.findMany({ select: { id: true, from: true, to: true } });
  const map = new Map(
    all.filter((r) => r.id !== excludeId).map((r) => [r.from, r.to] as const),
  );

  let cur = to;
  const seen = new Set([from]);
  for (let hops = 0; hops < 10; hops++) {
    if (seen.has(cur)) {
      throw new Error("Получается цикл: цепочка редиректов возвращается в исходный путь");
    }
    seen.add(cur);
    const next = map.get(cur);
    if (!next || next.startsWith("http")) return next ?? cur;
    cur = next;
  }
  throw new Error("Слишком длинная цепочка редиректов — проверьте существующие правила");
}

/**
 * Создать 308-редирект from → to (относительные пути / абсолютный URL для to).
 * Цепочки схлопываются: to резолвится до конечного назначения, а существующие
 * правила, указывающие на from, перенацеливаются — редирект всегда в один прыжок.
 */
export const createRedirectAction = safeAction(
  {
    schema: z.object({
      from: z.string().trim().min(1, "Укажите путь-источник").max(300),
      to: z.string().trim().min(1, "Укажите назначение").max(500),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const from = normalizePath(input.from);
    const to = input.to.startsWith("http") ? input.to.trim() : normalizePath(input.to);
    if (from === to) throw new Error("Источник и назначение совпадают");

    const exists = await db.redirect.findUnique({ where: { from } });
    if (exists) throw new Error("Редирект с таким источником уже есть");

    const finalTo = await flattenRedirectTarget(from, to);
    await db.redirect.create({ data: { from, to: finalTo } });
    // Правила, которые вели на from, теперь вели бы в цепочку — перенацеливаем.
    await db.redirect.updateMany({ where: { to: from }, data: { to: finalTo } });
    // Путь закрыт редиректом → убираем его из журнала 404.
    await db.notFoundHit.deleteMany({ where: { path: from } }).catch(() => {});
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.redirect.create",
      meta: { from, to: finalTo },
    });
    revalidatePath("/admin/seo/redirects");
    return { ok: true as const };
  },
);

/** Изменить существующий редирект (те же проверки циклов/цепочек, что при создании). */
export const updateRedirectAction = safeAction(
  {
    schema: z.object({
      id: z.string().min(1),
      from: z.string().trim().min(1, "Укажите путь-источник").max(300),
      to: z.string().trim().min(1, "Укажите назначение").max(500),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const from = normalizePath(input.from);
    const to = input.to.startsWith("http") ? input.to.trim() : normalizePath(input.to);
    if (from === to) throw new Error("Источник и назначение совпадают");

    const clash = await db.redirect.findUnique({ where: { from } });
    if (clash && clash.id !== input.id) {
      throw new Error("Редирект с таким источником уже есть");
    }

    const finalTo = await flattenRedirectTarget(from, to, input.id);
    await db.redirect.update({ where: { id: input.id }, data: { from, to: finalTo } });
    await db.redirect.updateMany({
      where: { to: from, id: { not: input.id } },
      data: { to: finalTo },
    });
    await db.notFoundHit.deleteMany({ where: { path: from } }).catch(() => {});
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.redirect.update",
      meta: { id: input.id, from, to: finalTo },
    });
    revalidatePath("/admin/seo/redirects");
    return { ok: true as const };
  },
);

/** Удалить редирект по id. */
export const deleteRedirectAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input, { session }) => {
    await db.redirect.delete({ where: { id: input.id } });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.redirect.delete",
      meta: { id: input.id },
    });
    revalidatePath("/admin/seo/redirects");
    return { ok: true as const };
  },
);

// ─────────────────────────── Разрезы по доменам и языкам ───────────────────────────

/**
 * Сохранить переопределения SEO для домена или языка (мультидомен, D-013).
 * Пустое поле = наследовать значение «для всех доменов», поэтому заполнять нужно
 * только то, что действительно отличается: коды подтверждения прав (у каждого
 * ресурса в Search Console и Вебмастере свой), гео-заголовки, местный телефон.
 * Только OWNER.
 */
export const updateSeoScopeOverrideAction = safeAction(
  {
    schema: z.object({
      scope: z.string().refine(isOverridableScope, "Неизвестный разрез"),
      titleTemplate: optStr(80),
      defaultTitle: optStr(120),
      defaultDescription: optStr(320),
      googleVerification: optStr(200),
      yandexVerification: optStr(200),
      ga4Id: optStr(40),
      yandexMetricaId: optStr(20),
      orgDescription: optStr(320),
      orgCountry: optStr(80),
      orgPhone: optStr(40),
      supportWhatsapp: optStr(200),
      socialTelegram: optStr(200),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const { scope, ...data } = input;
    await db.seoScopeOverride.upsert({
      where: { scope },
      create: { scope, ...data },
      update: data,
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.scope.update",
      meta: { scope, filled: Object.values(data).filter(Boolean).length },
    });

    revalidateSeoSettings();
    revalidatePath("/", "layout");
    return { ok: true as const };
  },
);

// ─────────────────────────── Статические страницы (каталог, оферта, политика) ───────────────────────────

/**
 * Сохранить SEO статической страницы. Пустые title/description → фолбэк страницы;
 * body (markdown) — текст thin-страниц (/offer, /privacy). Только OWNER.
 *
 * scope — домен и язык, для которых действует запись (мультидомен, D-013):
 * "global" пишется один раз для всех доменов, "KZ"/"KZ-kk"/"RU" перекрывают его.
 */
export const updateStaticPageSeoAction = safeAction(
  {
    schema: z.object({
      path: z.string().refine(isKnownStaticPage, "Неизвестная страница"),
      scope: z.string().refine(isKnownScope, "Неизвестный разрез"),
      title: optStr(120),
      description: optStr(320),
      noindex: z.boolean(),
      body: optStr(40_000),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const page = STATIC_PAGES.find((p) => p.path === input.path)!;
    const data = {
      title: input.title,
      description: input.description,
      noindex: input.noindex,
      // body сохраняем только там, где страница его рендерит (не для /courses).
      body: page.hasBody ? input.body : null,
    };
    await db.staticPageSeo.upsert({
      where: { path_scope: { path: input.path, scope: input.scope } },
      create: { path: input.path, scope: input.scope, ...data },
      update: data,
    });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.staticpage.update",
      meta: {
        path: input.path,
        scope: input.scope,
        noindex: input.noindex,
        hasBody: Boolean(data.body),
      },
    });

    revalidateStaticPageSeo();
    revalidatePath(input.path);
    return { ok: true as const };
  },
);

/**
 * AI-черновик текста thin-страницы (оферта/политика), Sonnet — по кнопке владельца.
 * Возвращает markdown; владелец читает, правит и сохраняет отдельным действием
 * (юридический текст стоит показать юристу — напоминание в форме).
 */
export async function draftStaticPageAction(
  raw: unknown,
): Promise<ActionResult<{ body: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }
  const parsed = z
    .object({ path: z.enum(["/offer", "/offer-b2b", "/privacy"]) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Неизвестная страница" };

  try {
    const s = await getSeoSettings();
    const body = await draftStaticPageText(parsed.data.path, {
      orgName: s.orgName,
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
      contact: s.orgPhone,
      userId: session.user.id,
    });
    return { ok: true, data: { body } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка AI" };
  }
}

// ─────────────────────────── Каннибализация (embeddings) ───────────────────────────

/** AI-анализ конкуренции курсов за один запрос (по кнопке — расход API контролируем). */
export async function analyzeCannibalizationAction(): Promise<
  ActionResult<CannibalReport>
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }
  try {
    const report = await analyzeCannibalization();
    return { ok: true, data: report };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка анализа" };
  }
}

// ─────────────────────────── Дефолтная OG-картинка сайта ───────────────────────────

/** Загрузка дефолтной OG-картинки сайта (приоритетнее авто-генерации opengraph-image). */
export async function uploadDefaultOgAction(
  formData: FormData,
): Promise<ActionResult<{ defaultOgKey: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Файл не получен" };
  if (file.size === 0) return { ok: false, error: "Файл пуст" };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Файл больше 8 МБ" };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Для OG допустимы PNG, JPEG или WebP" };
  }

  const ext = file.type.split("/")[1] ?? "png";
  const newKey = `og/site/og-${Date.now()}.${ext}`;

  try {
    normalizeKey(newKey);
    await storage.put(newKey, Buffer.from(await file.arrayBuffer()));

    const prev = (await db.seoSettings.findUnique({ where: { id: SEO_SETTINGS_ID } }))
      ?.defaultOgKey;
    await db.seoSettings.upsert({
      where: { id: SEO_SETTINGS_ID },
      create: { id: SEO_SETTINGS_ID, defaultOgKey: newKey },
      update: { defaultOgKey: newKey },
    });
    if (prev) {
      try {
        await storage.delete(prev);
      } catch {
        /* файла могло не быть */
      }
    }
    revalidateSeoSettings();
    return { ok: true, data: { defaultOgKey: newKey } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка загрузки" };
  }
}

/** Убрать дефолтную OG-картинку (вернуться к авто-генерации). */
export const removeDefaultOgAction = safeAction(
  { schema: z.object({}), auth: "owner" },
  async () => {
    const row = await db.seoSettings.findUnique({ where: { id: SEO_SETTINGS_ID } });
    if (row?.defaultOgKey) {
      try {
        await storage.delete(row.defaultOgKey);
      } catch {
        /* файла могло не быть */
      }
      await db.seoSettings.update({
        where: { id: SEO_SETTINGS_ID },
        data: { defaultOgKey: null },
      });
    }
    revalidateSeoSettings();
    return { ok: true as const };
  },
);

// ─────────────────────────── Семантика: кластеры тем + match-score ───────────────────────────

/** Карта тем: группировка курсов по смыслу фокус-ключей (по кнопке, embeddings). */
export async function keywordClustersAction(): Promise<ActionResult<ClusterReport>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }
  try {
    return { ok: true, data: await keywordClusters() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка анализа" };
  }
}

/** Соответствие фокус-ключа содержанию страницы (0..1) — embeddings, не «плотность». */
export async function keywordMatchAction(
  raw: unknown,
): Promise<ActionResult<{ match: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }
  const parsed = z
    .object({
      focusKeyword: z.string().trim().min(1, "Нет фокус-ключа").max(120),
      source: z.string().trim().min(1, "Нет контента").max(6000),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Заполните фокус-ключ и описание" };

  try {
    const match = await keywordMatch(parsed.data.focusKeyword, parsed.data.source);
    return { ok: true, data: { match } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка анализа" };
  }
}

/** Скрыть запись из журнала 404 (например, скан-шум бота). */
export const deleteNotFoundHitAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async (input) => {
    await db.notFoundHit.delete({ where: { id: input.id } });
    revalidatePath("/admin/seo/redirects");
    return { ok: true as const };
  },
);
