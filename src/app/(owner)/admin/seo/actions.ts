"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAdminLog } from "@/lib/admin/log";
import { safeAction, type ActionResult } from "@/lib/safe-action";
import { revalidateSeoSettings, SEO_SETTINGS_ID } from "@/lib/seo/settings";
import { normalizePath } from "@/lib/seo/redirects";
import {
  analyzeCannibalization,
  type CannibalReport,
} from "@/lib/seo/semantic";
import {
  generateMeta,
  scoreMeta,
  type MetaSuggestion,
  type MetaScore,
} from "@/lib/seo/ai";

/** Пустая строка → null (единый способ «очистить» опциональное поле). */
const optStr = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

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
      googleVerification: optStr(200),
      yandexVerification: optStr(200),
      ga4Id: optStr(40),
      yandexMetricaId: optStr(40),
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

/** Создать 308-редирект from → to (оба — относительные пути / абсолютный URL для to). */
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

    await db.redirect.create({ data: { from, to } });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.redirect.create",
      meta: { from, to },
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
