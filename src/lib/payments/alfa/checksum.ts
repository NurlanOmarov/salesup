import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Проверка контрольной суммы callback-уведомления Альфа-Банка
 * (docs/ALFA-PAYMENT-LINKS.md §12, симметричная криптография).
 *
 * Алгоритм шлюза:
 *   1. из набора параметров убираются `checksum` и `sign_alias`;
 *   2. оставшиеся пары сортируются по имени параметра по возрастанию и
 *      склеиваются в строку `имя;значение;имя;значение;…;` — с точкой с запятой
 *      в конце;
 *   3. от строки считается HMAC-SHA256 на общем токене, результат — в верхнем
 *      регистре.
 *
 * Токен генерируется в личном кабинете: Настройки → Мерчант → Callback
 * уведомления → тип подписи «Симметричный».
 */

/** Параметры, которые в подписи не участвуют. */
const EXCLUDED = new Set(["checksum", "sign_alias"]);

/** Строка, от которой считается контрольная сумма. Экспортирована ради тестов. */
export function checksumSource(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((name) => !EXCLUDED.has(name))
    .sort()
    .map((name) => `${name};${params[name]};`)
    .join("");
}

export function alfaChecksum(params: Record<string, string>, token: string): string {
  return createHmac("sha256", token).update(checksumSource(params), "utf8").digest("hex").toUpperCase();
}

/**
 * Подлинно ли уведомление. Сравнение за постоянное время: длина и содержимое
 * подписи не должны утекать через тайминг.
 */
export function verifyAlfaChecksum(params: Record<string, string>, token: string): boolean {
  const received = params.checksum;
  if (!received || !token) return false;

  const expected = Buffer.from(alfaChecksum(params, token), "utf8");
  const actual = Buffer.from(received.trim().toUpperCase(), "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
