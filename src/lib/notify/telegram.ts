import { env } from "@/env";
import { log } from "@/lib/log";

/**
 * Уведомления владельцу в Telegram (Bot API, без сторонних SDK — обычный fetch).
 * Используется из обработчика задачи `telegram.send` в worker-контейнере:
 * приложение сообщение не шлёт, оно ставит задачу в очередь, поэтому токен
 * нужен только воркеру.
 *
 * Содержимое сообщения (контакты заявителя — ПДн) не логируем, правило 9.
 */

/** Настроен ли канал уведомлений (есть токен бота и id чата). */
export function telegramConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

/**
 * Отправляет сообщение в чат владельца. Бросает при ошибке — Job-runner повторит
 * задачу (до maxAttempts), поэтому вызывать только из обработчиков очереди.
 */
export async function sendTelegramMessage(text: string, chatId?: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = chatId ?? env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error("telegram: не заданы TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // description Telegram-а не содержит ПДн — это причина отказа (чат не найден, токен неверен).
    const body = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`telegram sendMessage ${res.status}: ${body}`);
  }
  log.info("telegram: уведомление отправлено");
}
