import { env } from "@/env";
import { issueCertificateIfEligible } from "@/lib/certificates/issue";
import { log } from "@/lib/log";

/** Обработчик задачи: получает payload, выполняет, бросает при ошибке (для ретрая). */
export type JobHandler = (payload: unknown) => Promise<void>;

/**
 * Реестр обработчиков по типу задачи (S5.4). Каждый обработчик должен быть
 * идемпотентным (задача может выполниться повторно после сбоя/ретрая).
 */
export const handlers: Record<string, JobHandler> = {
  // Генерация сертификата — идемпотентна (issue проверяет уже выданный).
  "certificate.generate": async (payload) => {
    const { userId, courseId } = payload as { userId: string; courseId: string };
    if (!userId || !courseId) throw new Error("certificate.generate: нет userId/courseId");
    await issueCertificateIfEligible(userId, courseId);
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
  "digest.weekly": async () => {
    const { buildDigest } = await import("@/lib/digest/build.js");
    const d = await buildDigest(7);
    log.info(
      { newStudents: d.newStudents, active: d.activeStudents, certs: d.certificatesIssued, llmUsd: d.llmCostUsd },
      "digest.weekly собран",
    );
    // TODO(S5.5): при env.EMAIL_ENABLED отправить владельцу письмом.
  },

  // Ежедневное обслуживание (диск/БД, антишаринг-эвристики) — S6.1/S6.3.
  "maintenance.daily": async () => {
    log.info("maintenance.daily: ежедневные проверки (заглушка до S6.1/S6.3)");
  },

  // Пустая задача — для проверки воркера/тестов.
  noop: async () => {},
};
