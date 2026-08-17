/**
 * Разбор списка получателей уведомлений: `TELEGRAM_CHAT_ID` принимает как один
 * id, так и несколько через запятую («77980353,-1001234567890»). Чистый модуль
 * без env — чтобы тестировался без окружения.
 */
export function parseChatIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\s;]+/)) {
    const id = part.trim();
    // id чата — целое число, у групп со знаком минус
    if (/^-?\d+$/.test(id)) seen.add(id);
  }
  return [...seen];
}
