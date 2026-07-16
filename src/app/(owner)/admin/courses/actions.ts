"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/env";
import { storage, normalizeKey } from "@/lib/storage";
import { writeAdminLog } from "@/lib/admin/log";
import { log } from "@/lib/log";
import { safeAction, type ActionResult } from "@/lib/safe-action";
import { generateAltText } from "@/lib/seo/ai";

/**
 * Управление каталогом курсов (реестр / цены / фото). Только OWNER.
 * Цена хранится в tiyn (1 ₸ = 100 tiyn); админ вводит ₽/₸ в мажорных единицах.
 */

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const DURATIONS = [
  "LIFETIME",
  "MONTHS_1",
  "MONTHS_3",
  "MONTHS_6",
  "MONTHS_12",
] as const;

/** ₽ в tiyn: «49 000» → 4 900 000 tiyn. Допускает пробелы как разделители. */
function toTiyn(raw: number): number {
  return Math.max(0, Math.round(raw * 100));
}

export const updateCourseAction = safeAction(
  {
    schema: z.object({
      id: z.string().min(1),
      title: z.string().trim().min(1, "Укажите название").max(200),
      subtitle: z.string().trim().max(300).optional().or(z.literal("")),
      industry: z.string().trim().max(80).optional().or(z.literal("")),
      description: z.string().trim().max(8000).optional().or(z.literal("")),
      priceKzt: z.coerce.number().min(0),
      oldPriceKzt: z.coerce.number().min(0).optional(),
      status: z.enum(STATUSES),
      accessDuration: z.enum(DURATIONS),
      sortOrder: z.coerce.number().int().min(0).max(9999),
      hoursLabel: z.string().trim().max(40).optional().or(z.literal("")),
      seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
      seoDescription: z.string().trim().max(400).optional().or(z.literal("")),
      ogTitle: z.string().trim().max(200).optional().or(z.literal("")),
      ogDescription: z.string().trim().max(400).optional().or(z.literal("")),
      canonicalPath: z.string().trim().max(300).optional().or(z.literal("")),
      focusKeyword: z.string().trim().max(120).optional().or(z.literal("")),
      coverAlt: z.string().trim().max(200).optional().or(z.literal("")),
      seoNoindex: z.boolean(),
      certificateEnabled: z.boolean(),
    }),
    auth: "owner",
  },
  async (input, { session }) => {
    const existing = await db.course.findUnique({
      where: { id: input.id },
      select: { slug: true, status: true },
    });
    if (!existing) throw new Error("Курс не найден");

    const wasPublished = existing.status === "PUBLISHED";
    const nowPublished = input.status === "PUBLISHED";

    const data = {
      title: input.title,
      subtitle: input.subtitle || null,
      industry: input.industry || null,
      description: input.description || "",
      priceTiyn: toTiyn(input.priceKzt),
      oldPriceTiyn:
        input.oldPriceKzt && input.oldPriceKzt > input.priceKzt
          ? toTiyn(input.oldPriceKzt)
          : null,
      status: input.status,
      accessDuration: input.accessDuration,
      sortOrder: input.sortOrder,
      hoursLabel: input.hoursLabel || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      ogTitle: input.ogTitle || null,
      ogDescription: input.ogDescription || null,
      canonicalPath: input.canonicalPath || null,
      focusKeyword: input.focusKeyword || null,
      coverAlt: input.coverAlt || null,
      seoNoindex: input.seoNoindex,
      certificateEnabled: input.certificateEnabled,
      publishedAt: !wasPublished && nowPublished ? new Date() : undefined,
    };

    await db.course.update({ where: { id: input.id }, data });

    await writeAdminLog({
      actorId: session!.user.id,
      action: "course.update",
      meta: {
        courseId: input.id,
        slug: existing.slug,
        priceTiyn: data.priceTiyn,
        status: data.status,
      },
    });

    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${input.id}`);
    revalidatePath("/courses");
    revalidatePath(`/courses/${existing.slug}`);
    return { ok: true as const };
  },
);

const ALLOWED_COVER = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_COVER_BYTES = 8 * 1024 * 1024; // 8 МБ

/**
 * Загрузка обложки курса (FormData). Сохраняет файл в lib/storage под ключом
 * covers/<courseId>/cover-<ts>.<ext>, удаляет прежний файл, обновляет course.coverUrl.
 * Возвращает ActionResult с новым публичным ключом.
 */
export async function uploadCoverAction(
  formData: FormData,
): Promise<ActionResult<{ coverUrl: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }

  const courseId = String(formData.get("courseId") ?? "");
  const file = formData.get("file");
  if (!courseId) return { ok: false, error: "Не указан курс" };
  if (!(file instanceof File)) return { ok: false, error: "Файл не получен" };
  if (file.size === 0) return { ok: false, error: "Файл пуст" };
  if (file.size > MAX_COVER_BYTES) {
    return { ok: false, error: "Файл больше 8 МБ" };
  }
  if (!ALLOWED_COVER.has(file.type)) {
    return { ok: false, error: "Допустимы только PNG, JPEG, WebP, AVIF, GIF" };
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { slug: true, coverUrl: true },
  });
  if (!course) return { ok: false, error: "Курс не найден" };

  const ext = file.type.split("/")[1] ?? "webp";
  const ts = Date.now();
  const newKey = `covers/${courseId}/cover-${ts}.${ext}`;

  try {
    normalizeKey(newKey);
    const buf = Buffer.from(await file.arrayBuffer());
    await storage.put(newKey, buf);

    // удаляем прежнюю обложку, если она тоже лежала в хранилище
    const prev = course.coverUrl;
    if (prev && !prev.startsWith("/") && !prev.startsWith("http")) {
      try {
        normalizeKey(prev);
        await storage.delete(prev);
      } catch (e) {
        log.warn({ err: e, prev }, "course.cover: не удалось удалить старую обложку");
      }
    }

    await db.course.update({
      where: { id: courseId },
      data: { coverUrl: newKey },
    });

    await writeAdminLog({
      actorId: session.user.id,
      action: "course.cover",
      meta: { courseId, slug: course.slug, key: newKey, size: buf.length },
    });

    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath("/courses");
    revalidatePath(`/courses/${course.slug}`);
    return { ok: true, data: { coverUrl: newKey } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки";
    return { ok: false, error: msg };
  }
}

// ─────────────────────────── OG-картинка курса + AI alt-текст ───────────────────────────

/**
 * Загрузка кастомной OG-картинки курса (1200×630 рекомендуется). Приоритетнее
 * авто-генерации в courses/[slug]/opengraph-image. Хранится в lib/storage.
 */
export async function uploadOgImageAction(
  formData: FormData,
): Promise<ActionResult<{ ogImageUrl: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }

  const courseId = String(formData.get("courseId") ?? "");
  const file = formData.get("file");
  if (!courseId) return { ok: false, error: "Не указан курс" };
  if (!(file instanceof File)) return { ok: false, error: "Файл не получен" };
  if (file.size === 0) return { ok: false, error: "Файл пуст" };
  if (file.size > MAX_COVER_BYTES) return { ok: false, error: "Файл больше 8 МБ" };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Для OG допустимы PNG, JPEG или WebP" };
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { slug: true, ogImageUrl: true },
  });
  if (!course) return { ok: false, error: "Курс не найден" };

  const ext = file.type.split("/")[1] ?? "png";
  const newKey = `og/${courseId}/og-${Date.now()}.${ext}`;

  try {
    normalizeKey(newKey);
    await storage.put(newKey, Buffer.from(await file.arrayBuffer()));

    const prev = course.ogImageUrl;
    if (prev && !prev.startsWith("/") && !prev.startsWith("http")) {
      try {
        await storage.delete(prev);
      } catch (e) {
        log.warn({ err: e, prev }, "course.og: не удалось удалить старую OG-картинку");
      }
    }

    await db.course.update({ where: { id: courseId }, data: { ogImageUrl: newKey } });
    await writeAdminLog({
      actorId: session.user.id,
      action: "course.update",
      meta: { courseId, slug: course.slug, ogKey: newKey },
    });
    revalidatePath(`/courses/${course.slug}`);
    return { ok: true, data: { ogImageUrl: newKey } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка загрузки" };
  }
}

/** Убрать кастомную OG-картинку (вернуться к авто-генерации). */
export const removeOgImageAction = safeAction(
  { schema: z.object({ courseId: z.string().min(1) }), auth: "owner" },
  async (input) => {
    const course = await db.course.findUnique({
      where: { id: input.courseId },
      select: { slug: true, ogImageUrl: true },
    });
    if (!course) throw new Error("Курс не найден");
    const prev = course.ogImageUrl;
    if (prev && !prev.startsWith("/") && !prev.startsWith("http")) {
      try {
        await storage.delete(prev);
      } catch {
        /* файл мог отсутствовать */
      }
    }
    await db.course.update({ where: { id: input.courseId }, data: { ogImageUrl: null } });
    revalidatePath(`/courses/${course.slug}`);
    return { ok: true as const };
  },
);

/**
 * AI alt-текст обложки (Haiku vision): смотрит на саму картинку + контекст курса.
 * Возвращает ПРЕДЛОЖЕНИЕ — владелец применяет его в форме (поле coverAlt) и сохраняет.
 */
export async function generateCoverAltAction(
  raw: unknown,
): Promise<ActionResult<{ alt: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { ok: false, error: "Недостаточно прав" };
  }
  const parsed = z.object({ courseId: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Не указан курс" };

  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { title: true, industry: true, coverUrl: true },
  });
  if (!course?.coverUrl) return { ok: false, error: "У курса нет обложки" };

  try {
    // Обложка: ключ хранилища → storage; сид-путь /images/… или http → fetch.
    let buf: Buffer;
    let mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    const src = course.coverUrl;
    if (src.startsWith("/") || src.startsWith("http")) {
      const url = src.startsWith("http")
        ? src
        : `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${src}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Обложка недоступна (${res.status})`);
      buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") ?? "";
      mediaType = ct.includes("jpeg") ? "image/jpeg" : ct.includes("webp") ? "image/webp" : ct.includes("gif") ? "image/gif" : "image/png";
    } else {
      buf = await storage.get(src);
      const ext = src.slice(src.lastIndexOf(".") + 1).toLowerCase();
      mediaType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png";
    }
    if (buf.length > 5 * 1024 * 1024) return { ok: false, error: "Обложка слишком велика для анализа (>5 МБ)" };

    const alt = await generateAltText({
      imageBase64: buf.toString("base64"),
      mediaType,
      context: `Обложка курса «${course.title}»${course.industry ? `, отрасль: ${course.industry}` : ""}`,
      userId: session.user.id,
    });
    return { ok: true, data: { alt } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка AI" };
  }
}
