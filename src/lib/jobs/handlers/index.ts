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

  // Сверка с магазином activesales.by: добираем оплаченные заказы, по которым
  // webhook не дошёл (docs/WOO-INTEGRATION.md). Идемпотентна — уже обработанные
  // заказы пропускает по WebhookEvent.
  "woo.reconcile": async () => {
    const { reconcileWooOrders } = await import("@/lib/payments/woo/reconcile.js");
    await reconcileWooOrders();
  },

  // Уведомление владельцу в Telegram (новая заявка с сайта). Без настроенного
  // бота просто логируем — заявка в любом случае уже сохранена в БД и админке.
  "telegram.send": async (payload) => {
    // buttons — кнопки-ссылки под сообщением (переход в мессенджер клиента).
    const { text, chatId, buttons } = payload as {
      text?: string;
      chatId?: string;
      buttons?: { text: string; url: string }[][];
    };
    if (!text) throw new Error("telegram.send: нет text");
    const { sendTelegramMessage, telegramConfigured } = await import("@/lib/notify/telegram.js");
    if (!telegramConfigured() && !chatId) {
      log.info("telegram.send пропущен: бот не настроен");
      return;
    }
    await sendTelegramMessage(text, chatId, buttons);
  },

  // Письмо с PDF сертификата (D-019): ответственному представителю организации
  // (B2B) или самому ученику (розница). PDF читаем из lib/storage здесь, а не
  // кладём в payload — Job хранит JSON, мегабайты base64 в нём ни к чему.
  // Идемпотентно по emailedAt: повтор задачи после успешной отправки — no-op.
  "certificate.email": async (payload) => {
    const { certificateId } = payload as { certificateId?: string };
    if (!certificateId) throw new Error("certificate.email: нет certificateId");
    const { sendCertificateEmail } = await import("@/lib/certificates/email.js");
    await sendCertificateEmail(certificateId);
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

  // B2B: письмо клиенту-организации со всеми доступами (ответственный + работники).
  // Пароли генерируются здесь и нигде не хранятся, поэтому в payload только адреса и
  // идентификаторы. Повторы отключены (maxAttempts=1): отправка идёт по кнопке
  // владельца, и при сбое он видит красный статус и жмёт ещё раз; о провале
  // сообщаем в Telegram, чтобы не зависеть от того, откроет ли он карточку.
  "org.send-credentials": async (payload) => {
    const { orgId, to, actorId } = payload as { orgId?: string; to?: string; actorId?: string };
    if (!orgId || !to || !actorId) throw new Error("org.send-credentials: нет orgId/to/actorId");
    const { sendOrgCredentials, notifyCredentialsFailed } = await import("@/lib/org/credentials.js");
    try {
      await sendOrgCredentials({ orgId, to, actorId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await notifyCredentialsFailed(orgId, reason);
      throw error;
    }
  },

  // Самообслуживание: письмо со ссылкой сброса пароля. Токен создаётся в обработчике
  // и в payload не попадает — в очереди только адрес и домен витрины.
  "auth.send-reset": async (payload) => {
    const { email, siteUrl } = (payload ?? {}) as { email?: string; siteUrl?: string };
    if (!email) throw new Error("auth.send-reset: нет email");
    const { sendPasswordResetEmail } = await import("@/lib/auth/send-reset.js");
    await sendPasswordResetEmail({ email, siteUrl });
  },

  // Уведомление «пароль изменён» после сброса по ссылке.
  "auth.password-changed": async (payload) => {
    const { email } = (payload ?? {}) as { email?: string };
    if (!email) throw new Error("auth.password-changed: нет email");
    const { sendPasswordChangedEmail } = await import("@/lib/auth/send-reset.js");
    await sendPasswordChangedEmail(email);
  },

  // Пустая задача — для проверки воркера/тестов.
  noop: async () => {},
};
