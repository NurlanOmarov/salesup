"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction } from "@/lib/safe-action";
import { writeAdminLog } from "@/lib/admin/log";

/**
 * Отзывы с внешних площадок переносит владелец вручную (docs/MULTI-DOMAIN-PLAN.md
 * не при чём — это блок доверия на лендинге): парсинг Яндекс/Google Карт нарушает
 * их условия, поэтому текст, автор и ссылка вводятся здесь.
 */
const reviewSchema = z.object({
  source: z.enum(["YANDEX", "GOOGLE", "OTHER"]),
  author: z.string().trim().min(1, "Укажите автора").max(120),
  text: z.string().trim().min(10, "Слишком короткий отзыв").max(2000),
  // Оценка необязательна: в выгрузке с карт её может не быть, а придумывать нельзя.
  rating: z.number().int().min(1).max(5).nullable(),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
  sortOrder: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(true),
});

export const createExternalReviewAction = safeAction(
  { schema: reviewSchema, auth: "owner" },
  async (input, { session }) => {
    const row = await db.externalReview.create({ data: input });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "review.external.create",
      meta: { id: row.id, source: row.source },
    });
    revalidatePath("/");
    revalidatePath("/admin/reviews");
    return { ok: true as const, id: row.id };
  },
);

export const updateExternalReviewAction = safeAction(
  { schema: reviewSchema.extend({ id: z.string().min(1) }), auth: "owner" },
  async ({ id, ...data }, { session }) => {
    await db.externalReview.update({ where: { id }, data });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "review.external.update",
      meta: { id, published: data.published },
    });
    revalidatePath("/");
    revalidatePath("/admin/reviews");
    return { ok: true as const };
  },
);

export const deleteExternalReviewAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async ({ id }, { session }) => {
    await db.externalReview.delete({ where: { id } });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "review.external.delete",
      meta: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/reviews");
    return { ok: true as const };
  },
);
