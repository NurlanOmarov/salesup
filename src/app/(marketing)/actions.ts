"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  contact: z
    .string()
    .trim()
    .min(3, "Укажите телефон, e-mail или @username")
    .max(160),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  courseId: z.string().trim().max(40).optional().or(z.literal("")),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const { name, contact, message, courseId } = parsed.data;

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
      status: "NEW",
    },
  });

  log.info({ courseId: validCourseId ?? null }, "lead.created");
  return { ok: true };
}
