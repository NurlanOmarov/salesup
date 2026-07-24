/** Форматирование чисел для дашборда (ru-RU). Чистые функции — можно и на клиенте. */

const intFmt = new Intl.NumberFormat("ru-RU");

export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n));
}

export function fmtPct(n: number): string {
  return intFmt.format(Math.round(n * 10) / 10) + "%";
}

/** Знак прироста со стрелкой: "+12,5%" / "−4%" / "0%". */
export function fmtDelta(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return sign + intFmt.format(rounded) + "%";
}

/** Флаг-эмодзи из ISO-кода страны (BY → 🇧🇾). */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

let regionNames: Intl.DisplayNames | null = null;
/** Русское название страны по ISO-коду (BY → «Беларусь»). */
export function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(["ru"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
