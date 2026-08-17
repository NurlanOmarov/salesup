/**
 * Экранирование под Telegram parse_mode=HTML (провайдер требует только эти три
 * символа). Отдельный модуль без зависимостей от env — чтобы формирование текста
 * уведомлений оставалось чистым и тестировалось без окружения.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
