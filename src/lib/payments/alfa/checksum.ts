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

/** Раскодировать значение ещё раз; на неполном проценте возвращает как есть. */
function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/**
 * Наборы значений, по которым имеет смысл проверять подпись.
 *
 * Шлюз присылает значения закодированными дважды: тело POST разбирается один
 * раз, и в кириллических полях (`orderDescription`, `name`) остаётся ещё одна
 * percent-строка. Подпись же считается по исходному тексту — тому, что владелец
 * ввёл в кабинете. Поэтому проверяем и то, что пришло, и раскодированное:
 * какой вариант сойдётся, тот и есть настоящий (это выясняется только опытом,
 * состав полей у каждого мерчанта свой).
 *
 * Безопасность от этого не страдает: любой вариант нужно подписать токеном,
 * известным только шлюзу и нам.
 */
export function checksumVariants(params: Record<string, string>): Array<Record<string, string>> {
  const decoded = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, k === "checksum" ? v : decodeOnce(v)]),
  );
  // Если декодировать нечего, второй вариант совпадёт с первым — не дублируем.
  const same = Object.entries(decoded).every(([k, v]) => params[k] === v);
  return same ? [params] : [params, decoded];
}

/**
 * Проверка по всем вариантам. Возвращает подошедший набор значений (его и
 * используем дальше — в нём поля уже в читаемом виде) либо null.
 */
export function verifyAlfaCallback(
  params: Record<string, string>,
  token: string,
): Record<string, string> | null {
  for (const variant of checksumVariants(params)) {
    if (verifyAlfaChecksum(variant, token)) return variant;
  }
  return null;
}
