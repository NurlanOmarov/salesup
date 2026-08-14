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

  // Отправка письма — фактическая отправка появится в S5.5 (nodemailer). Пока:
  // при выключенном EMAIL_ENABLED просто логируем (уведомления не критичны в MVP).
  "email.send": async (payload) => {
    const { to, subject } = payload as { to?: string; subject?: string };
    if (!env.EMAIL_ENABLED) {
      log.info({ to, subject }, "email.send пропущен: EMAIL_ENABLED=false");
      return;
    }
    // TODO(S5.5): nodemailer SMTP
    log.info({ to, subject }, "email.send: отправка (заглушка)");
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
