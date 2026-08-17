"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/env";
import { log } from "@/lib/log";
import { enqueue } from "@/lib/jobs/enqueue";
import { leadTelegramText, ownerLeadEmail } from "@/lib/leads/notify";
import { leadQuote } from "@/lib/leads/quote";
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
  // Выбранный в калькуляторе тариф. Присылается только выбор — цену считает
  // сервер (lib/leads/quote), клиентской сумме верить нельзя.
  plan: z.enum(["LIBRARY", "COURSES"]).optional().or(z.literal("")),
  planCourseIds: z.string().trim().max(500).optional().or(z.literal("")),
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
    plan: formData.get("plan") ?? "",
    planCourseIds: formData.get("planCourseIds") ?? "",
    consent: formData.get("consent") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const { name, contact, message, courseId, kind, company, seatsWanted, plan, planCourseIds } =
    parsed.data;

  // courseId привязываем только если такой курс существует (форма на странице курса)
  let validCourseId: string | undefined;
  let courseTitle: string | undefined;
  let courseTiyn: number | undefined;
  if (courseId) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, priceTiyn: true },
    });
    validCourseId = course?.id;
    courseTitle = course?.title;
    courseTiyn = course?.priceTiyn ?? undefined;
  }

  // Цены выбранных в калькуляторе курсов берём из БД, а не из формы: сумма в
  // заявке должна совпадать с той, что показал калькулятор, и не поддаваться
  // правке в браузере.
  const selectedIds = (planCourseIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20);
  const selectedCoursesTiyn =
    kind === "B2B" && plan === "COURSES" && selectedIds.length > 0
      ? (
          await db.course.findMany({
            where: { id: { in: selectedIds } },
            select: { priceTiyn: true },
          })
        ).map((c) => c.priceTiyn)
      : [];

  const quote = leadQuote({
    kind,
    plan: plan || null,
    seats: seatsWanted ?? null,
    courseTiyn: courseTiyn ?? null,
    selectedCoursesTiyn,
  });

  const lead = await db.lead.create({
    data: {
      name: name || null,
      contact,
      message: message || null,
      courseId: validCourseId ?? null,
      kind,
      company: kind === "B2B" ? company || null : null,
      seatsWanted: kind === "B2B" ? (seatsWanted ?? null) : null,
      plan: quote?.plan ?? null,
      quotedPerSeatTiyn: quote?.perSeatTiyn ?? null,
      quotedTotalTiyn: quote?.totalTiyn ?? null,
      status: "NEW",
      // Доказательство согласия: момент + принятая редакция документов.
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
    },
    select: { id: true, createdAt: true },
  });

  // Уведомления ставим в очередь: отправляет их worker, форма не ждёт SMTP и не
  // падает, если почта недоступна (сама заявка уже сохранена — это главное).
  const notification = {
    kind,
    name: name || null,
    contact,
    message: message || null,
    company: kind === "B2B" ? company || null : null,
    seatsWanted: kind === "B2B" ? (seatsWanted ?? null) : null,
    courseTitle: courseTitle ?? null,
    quote,
    createdAt: lead.createdAt,
  };

  try {
    await enqueue("telegram.send", {
      text: leadTelegramText(notification, env.NEXT_PUBLIC_SITE_URL),
      kind: "lead-owner",
      leadId: lead.id,
    });
    // Дубль на почту — опционально, одним флагом EMAIL_ENABLED (SMTP настраивается
    // в secrets). По умолчанию выключено: основной канал — Telegram.
    if (env.EMAIL_ENABLED) {
      await enqueue("email.send", {
        ...ownerLeadEmail(env.LEADS_NOTIFY_EMAIL, notification),
        kind: "lead-owner",
        leadId: lead.id,
      });
    }
  } catch (e) {
    log.error({ err: e, leadId: lead.id }, "lead.notify: не удалось поставить уведомление в очередь");
  }

  log.info({ courseId: validCourseId ?? null, kind }, "lead.created");
  return { ok: true };
}
