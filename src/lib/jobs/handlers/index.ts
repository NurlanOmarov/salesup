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

  // Еженедельный дайджест владельцу (S6.2) — полноценная сборка данных позже.
  "digest.weekly": async () => {
    log.info("digest.weekly: формирование дайджеста (заглушка до S6.2)");
  },

  // Ежедневное обслуживание (диск/БД, антишаринг-эвристики) — S6.1/S6.3.
  "maintenance.daily": async () => {
    log.info("maintenance.daily: ежедневные проверки (заглушка до S6.1/S6.3)");
  },

  // Пустая задача — для проверки воркера/тестов.
  noop: async () => {},
};
