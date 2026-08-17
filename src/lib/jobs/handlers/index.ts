import { env } from "@/env";
import { markCertificateReadyIfEligible } from "@/lib/certificates/issue";
import { log } from "@/lib/log";

/** Обработчик задачи: получает payload, выполняет, бросает при ошибке (для ретрая). */
export type JobHandler = (payload: unknown) => Promise<void>;

/**
 * Реестр обработчиков по типу задачи (S5.4). Каждый обработчик должен быть
 * идемпотентным (задача может выполниться повторно после сбоя/ретрая).
 */
export const handlers: Record<string, JobHandler> = {
  // Фиксация готовности к сертификату — идемпотентна (проверяет существующую запись).
  // ПДн не формируем: выдачу владелец подтверждает вручную в админке.
  "certificate.generate": async (payload) => {
    const { userId, courseId } = payload as { userId: string; courseId: string };
    if (!userId || !courseId) throw new Error("certificate.generate: нет userId/courseId");
    await markCertificateReadyIfEligible(userId, courseId);
  },

  // Отправка письма через SMTP (S5.5). При выключенном EMAIL_ENABLED просто
  // логируем (уведомления не критичны в MVP). Адрес получателя редактируется
  // логгером (правило 9), в лог идёт только тема.
  "email.send": async (payload) => {
    const { to, subject, text, html, replyTo } = payload as {
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
      replyTo?: string;
    };
    if (!env.EMAIL_ENABLED) {
      log.info({ subject }, "email.send пропущен: EMAIL_ENABLED=false");
      return;
    }
    if (!to || !subject) throw new Error("email.send: нет to/subject");
    const { sendEmail } = await import("@/lib/email/send.js");
    await sendEmail({ to, subject, text: text ?? "", html, replyTo });
  },

  // Еженедельный дайджест владельцу (S6.2): собираем сводку, при EMAIL_ENABLED
  // отправляем письмо (S5.5), иначе она доступна на странице /admin/digest.
  // semantic: true — раз в неделю считаем SEO-каннибализацию (embeddings, доли цента;
  // правило 10 — единственный автоматический AI-расход, виден в LlmUsage).
  "digest.weekly": async () => {
    const { buildDigest } = await import("@/lib/digest/build.js");
    const d = await buildDigest(7, new Date(), { semantic: true });
    log.info(
      {
        newStudents: d.newStudents,
        active: d.activeStudents,
        certs: d.certificatesIssued,
        llmUsd: d.llmCostUsd,
        notFound404: d.notFoundTotal,
        redirectHits: d.redirectHits,
        seoCannibalPairs: d.cannibalPairs,
      },
      "digest.weekly собран",
    );
    // TODO(S5.5): при env.EMAIL_ENABLED отправить владельцу письмом.
  },

  // Ежедневное обслуживание (диск/БД, антишаринг-эвристики) — S6.1/S6.3.
  // Здесь же — истечение корпоративных лицензий: срок наступает сам, события нет.
  "maintenance.daily": async () => {
    const { syncAllOrgAccess } = await import("@/lib/org/sync.js");
    await syncAllOrgAccess();
    log.info("maintenance.daily: ежедневные проверки (заглушка до S6.1/S6.3)");
  },

  // Ежедневные учебные напоминания: ставит в очередь письма ученикам с карточками
  // к повторению / серией под угрозой. Запускается раз в сутки cron-ом воркера.
  "reminders.daily": async () => {
    const { buildDailyReminders } = await import("@/lib/learn/reminders.js");
    const r = await buildDailyReminders();
    log.info({ candidates: r.candidates, enqueued: r.enqueued }, "reminders.daily: напоминания поставлены");
  },

  // B2B: привести места организации в соответствие с её статусом и лицензиями.
  // Идемпотентна: повторный запуск ничего не меняет, если всё уже согласовано.
  // Без orgId в payload синхронизирует все организации (ежедневный проход).
  "org.sync-access": async (payload) => {
    const { orgId } = (payload ?? {}) as { orgId?: string };
    const { syncOrgAccess, syncAllOrgAccess } = await import("@/lib/org/sync.js");
    const result = orgId ? await syncOrgAccess(orgId) : await syncAllOrgAccess();
    log.info({ orgId: orgId ?? "all", ...result }, "org.sync-access выполнена");
  },

  // Пустая задача — для проверки воркера/тестов.
  noop: async () => {},
};
