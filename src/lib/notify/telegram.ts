import { env } from "@/env";
import { log } from "@/lib/log";
import { parseChatIds } from "./chat-ids.js";

/**
 * Уведомления владельцу в Telegram (Bot API, без сторонних SDK — обычный fetch).
 * Используется из обработчика задачи `telegram.send` в worker-контейнере:
 * приложение сообщение не шлёт, оно ставит задачу в очередь, поэтому токен
 * нужен только воркеру.
 *
 * Получателей может быть несколько: `TELEGRAM_CHAT_ID` принимает список id через
 * запятую (личка каждого) либо один id группы — тогда уведомление видит вся команда.
 *
 * Содержимое сообщения (контакты заявителя — ПДн) не логируем, правило 9.
 */

/** Настроен ли канал уведомлений (есть токен бота и хотя бы один чат). */
export function telegramConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN) && parseChatIds(env.TELEGRAM_CHAT_ID).length > 0;
}

/** Отправка одному чату; бросает с причиной отказа Telegram-а. */
async function sendToChat(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
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
}

/**
 * Отправляет сообщение всем получателям. Бросает, только если не дошло ни до
 * кого — иначе один заблокировавший бота сотрудник заставлял бы Job-runner
 * повторять задачу и слал дубли остальным.
 */
export async function sendTelegramMessage(text: string, chatId?: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chats = chatId ? parseChatIds(chatId) : parseChatIds(env.TELEGRAM_CHAT_ID);
  if (!token || chats.length === 0) {
    throw new Error("telegram: не заданы TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID");
  }

  const errors: string[] = [];
  for (const chat of chats) {
    try {
      await sendToChat(token, chat, text);
    } catch (e) {
      errors.push(`${chat}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length === chats.length) throw new Error(errors.join("; "));
  if (errors.length > 0) log.error({ errors }, "telegram: часть получателей не получила уведомление");
  log.info({ delivered: chats.length - errors.length }, "telegram: уведомление отправлено");
}
