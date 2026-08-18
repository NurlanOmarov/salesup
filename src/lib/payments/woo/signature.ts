import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Проверка подписи webhook-а WooCommerce.
 *
 * Магазин подписывает СЫРОЕ тело запроса: base64(HMAC-SHA256(body, secret)) —
 * заголовок `X-WC-Webhook-Signature`. Секрет задаётся при создании вебхука в
 * WP-админке и хранится у нас в WOO_WEBHOOK_SECRET (docs/WOO-INTEGRATION.md).
 *
 * Тело сравниваем именно в исходном виде: пересборка JSON меняет порядок ключей
 * и пробелы, подпись после этого не сходится.
 */
export function wooSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
}

/** Сравнение за постоянное время: длина подписи не должна утекать через тайминг. */
export function verifyWooSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
): boolean {
  if (!header || !secret) return false;

  const expected = Buffer.from(wooSignature(rawBody, secret), "utf8");
  const received = Buffer.from(header.trim(), "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
