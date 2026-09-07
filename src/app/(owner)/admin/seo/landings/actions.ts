"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction } from "@/lib/safe-action";
import { writeAdminLog } from "@/lib/admin/log";
import { revalidateLandings } from "@/lib/seo/landings";

/**
 * SEO-посадочные (/obuchenie/<slug>): страницы под кластеры запросов.
 *
 * Ключи и FAQ владелец вводит текстом (по строке на запрос, «вопрос :: ответ»),
 * а не JSON-ом: страницы пишутся десятками, и редактор не должен требовать
 * знания синтаксиса.
 */
const landingSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только латиница в нижнем регистре и дефисы"),
  cluster: z.string().trim().max(80).optional().transform((v) => v || null),
  title: z.string().trim().min(10, "Заголовок слишком короткий").max(200),
  description: z.string().trim().min(30, "Описание слишком короткое").max(400),
  h1: z.string().trim().min(5).max(200),
  intro: z.string().trim().min(40, "Вступление слишком короткое").max(1000),
  body: z.string().trim().min(300, "Текст короче 300 символов не ранжируется"),
  courseId: z.string().trim().optional().transform((v) => v || null),
  /** По ключу в строке, «запрос 1234» или просто «запрос». */
  keywords: z.string().max(4000).optional(),
  /** По строке «вопрос :: ответ». */
  faq: z.string().max(8000).optional(),
  published: z.boolean().default(false),
  noindex: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

function parseKeywords(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 300);
}

function parseFaqLines(raw: string | undefined): { q: string; a: string }[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.split("::"))
    .flatMap(([q, ...rest]) => {
      const question = (q ?? "").trim();
      const answer = rest.join("::").trim();
      return question && answer ? [{ q: question, a: answer }] : [];
    })
    .slice(0, 20);
}

function toData(input: z.infer<typeof landingSchema>) {
  const { keywords, faq, ...rest } = input;
  return {
    ...rest,
    keywords: parseKeywords(keywords),
    faq: parseFaqLines(faq),
  };
}

export const createLandingAction = safeAction(
  { schema: landingSchema, auth: "owner" },
  async (input, { session }) => {
    const row = await db.seoLanding.create({ data: toData(input) });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.landing.create",
      meta: { id: row.id, slug: row.slug },
    });
    revalidateLandings();
    revalidatePath("/admin/seo/landings");
    revalidatePath(`/obuchenie/${row.slug}`);
    return { ok: true as const, id: row.id };
  },
);

export const updateLandingAction = safeAction(
  { schema: landingSchema.extend({ id: z.string().min(1) }), auth: "owner" },
  async ({ id, ...input }, { session }) => {
    const row = await db.seoLanding.update({ where: { id }, data: toData(input) });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.landing.update",
      meta: { id, slug: row.slug, published: row.published },
    });
    revalidateLandings();
    revalidatePath("/admin/seo/landings");
    revalidatePath(`/obuchenie/${row.slug}`);
    return { ok: true as const };
  },
);

export const deleteLandingAction = safeAction(
  { schema: z.object({ id: z.string().min(1) }), auth: "owner" },
  async ({ id }, { session }) => {
    const row = await db.seoLanding.delete({ where: { id } });
    await writeAdminLog({
      actorId: session!.user.id,
      action: "seo.landing.delete",
      meta: { id, slug: row.slug },
    });
    revalidateLandings();
    revalidatePath("/admin/seo/landings");
    return { ok: true as const };
  },
);
