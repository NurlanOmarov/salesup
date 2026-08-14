"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { LEGAL_VERSION } from "@/content/legal";

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  contact: z
    .string()
    .trim()
    .min(3, "Укажите телефон, e-mail или @username")
    .max(160),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  courseId: z.string().trim().max(40).optional().or(z.literal("")),
  // B2B-заявка со страницы /business: сколько сотрудников и какая организация.
  // По числу мест сразу виден уровень корпоративной сетки (lib/pricing).
  kind: z.enum(["B2C", "B2B"]).default("B2C"),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  seatsWanted: z.coerce.number().int().min(1).max(100000).optional(),
  // Согласие на обработку ПДн — обязательное условие приёма заявки (Закон № 99-З):
  // без отметки заявка не сохраняется вовсе, а не сохраняется «без согласия».
  consent: z.literal("on", {
    errorMap: () => ({ message: "Отметьте согласие на обработку персональных данных" }),
  }),
});

export interface LeadFormState {
  ok?: boolean;
  error?: string;
}

/**
 * Публичная форма заявки (S1.2/S1.3): запись Lead со статусом NEW.
 * Без онлайн-оплаты — владелец обрабатывает заявку вручную (видит в /admin/leads, S5.1),
 * новые заявки попадают в еженедельный дайджест.
 */
export async function createLeadAction(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    contact: formData.get("contact") ?? "",
    message: formData.get("message") ?? "",
    courseId: formData.get("courseId") ?? "",
    kind: formData.get("kind") ?? "B2C",
    company: formData.get("company") ?? "",
    seatsWanted: formData.get("seatsWanted") || undefined,
    consent: formData.get("consent") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const { name, contact, message, courseId, kind, company, seatsWanted } = parsed.data;

  // courseId привязываем только если такой курс существует (форма на странице курса)
  let validCourseId: string | undefined;
  if (courseId) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    validCourseId = course?.id;
  }

  await db.lead.create({
    data: {
      name: name || null,
      contact,
      message: message || null,
      courseId: validCourseId ?? null,
      kind,
      company: kind === "B2B" ? company || null : null,
      seatsWanted: kind === "B2B" ? (seatsWanted ?? null) : null,
      status: "NEW",
      // Доказательство согласия: момент + принятая редакция документов.
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
    },
  });

  log.info({ courseId: validCourseId ?? null, kind }, "lead.created");
  return { ok: true };
}
