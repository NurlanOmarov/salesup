"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/env";
import { log } from "@/lib/log";
import { enqueue } from "@/lib/jobs/enqueue";
import { leadTelegramText, ownerLeadEmail } from "@/lib/leads/notify";
import { leadQuote } from "@/lib/leads/quote";
import { acceptedLegalVersion } from "@/lib/legal/version";
import { currentSite } from "@/lib/seo/site";
import { currency, usdToTiyn } from "@/lib/currency";
import { TRAINER_PACK_USD } from "@/lib/pricing";

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
  // Офлайн — живой корпоративный тренинг: платформа его не продаёт, поэтому
  // тариф и расчёт к такой заявке не применяются (см. ниже).
  format: z.enum(["ONLINE", "OFFLINE"]).default("ONLINE"),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  seatsWanted: z.coerce.number().int().min(1).max(100000).optional(),
  // Выбранные в калькуляторе курсы. Присылается только выбор — цену считает
  // сервер (lib/leads/quote), клиентской сумме верить нельзя.
  planCourseIds: z.string().trim().max(500).optional().or(z.literal("")),
  // Пакет с живыми сессиями тренера (lib/pricing TRAINER_PACK): надбавка
  // фиксированная, но сумму всё равно считает сервер — из формы приходит только
  // сам факт выбора.
  withTrainer: z
    .union([z.literal("1"), z.literal("")])
    .optional()
    .transform((v) => v === "1"),
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
    format: formData.get("format") ?? "ONLINE",
    company: formData.get("company") ?? "",
    seatsWanted: formData.get("seatsWanted") || undefined,
    planCourseIds: formData.get("planCourseIds") ?? "",
    withTrainer: formData.get("withTrainer") ?? "",
    consent: formData.get("consent") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  const {
    name,
    contact,
    message,
    courseId,
    kind,
    company,
    seatsWanted,
    planCourseIds,
    format,
    withTrainer,
  } = parsed.data;
  // Офлайн-тренинг платформа не продаёт: тариф и расчёт к нему неприменимы,
  // поэтому обнуляем их даже если что-то пришло из формы.
  const isOffline = format === "OFFLINE";

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
    kind === "B2B" && selectedIds.length > 0
      ? (
          await db.course.findMany({
            where: { id: { in: selectedIds } },
            select: { priceTiyn: true },
          })
        ).map((c) => c.priceTiyn)
      : [];

  // Тренерский пакет задан в долларах — в BYN переводим по тому же курсу, что
  // и витрина, иначе сумма в заявке разойдётся с калькулятором.
  const trainerTiyn =
    kind === "B2B" && withTrainer && !isOffline
      ? usdToTiyn(TRAINER_PACK_USD, (await currency.getRates()).rates)
      : 0;

  const quote = isOffline
    ? null
    : leadQuote({
        kind,
        seats: seatsWanted ?? null,
        courseTiyn: courseTiyn ?? null,
        selectedCoursesTiyn,
        withTrainer: withTrainer && kind === "B2B",
        trainerTiyn,
      });

  const site = await currentSite();

  const lead = await db.lead.create({
    data: {
      name: name || null,
      contact,
      message: message || null,
      courseId: validCourseId ?? null,
      kind,
      format,
      company: kind === "B2B" ? company || null : null,
      seatsWanted: kind === "B2B" ? (seatsWanted ?? null) : null,
      plan: quote?.plan ?? null,
      quotedPerSeatTiyn: quote?.perSeatTiyn ?? null,
      quotedTotalTiyn: quote?.totalTiyn ?? null,
      withTrainer: (quote?.trainerTiyn ?? 0) > 0,
      status: "NEW",
      // Доказательство согласия: момент + принятая редакция документов.
      consentAt: new Date(),
      consentVersion: await acceptedLegalVersion(),
      site: site?.code ?? null,
    },
    select: { id: true, createdAt: true },
  });

  // Уведомления ставим в очередь: отправляет их worker, форма не ждёт SMTP и не
  // падает, если почта недоступна (сама заявка уже сохранена — это главное).
  const notification = {
    kind,
    format,
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

  log.info({ courseId: validCourseId ?? null, kind, format }, "lead.created");
  return { ok: true };
}
