/**
 * ФИО на сертификате и производные от него. Чистая логика — юнит-тестируема.
 *
 * Ученик вводит ФИО сам (шаг 2 на странице сертификатов), поэтому ввод
 * нормализуем мягко: лишние пробелы убираем, регистр не трогаем — у фамилий
 * бывают «деЛюка», «Мак-Грегор», и исправлять человека мы не берёмся.
 */

/** Буквы кириллицы (включая казахские, белорусские, узбекские), латиница, дефис, апостроф. */
const WORD_RE = /^[\p{L}][\p{L}'ʼʻ’-]*$/u;

export function normalizeHolderName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export type HolderNameError = "TOO_SHORT" | "TOO_LONG" | "WORDS" | "CHARS";

/**
 * ФИО — от двух до пяти слов (фамилия и имя обязательны, отчество — по желанию;
 * у казахских и узбекских имён бывает «Нурлан Бахытұлы» или «… қызы»), только буквы.
 */
export function validateHolderName(name: string): HolderNameError | null {
  if (name.length < 5) return "TOO_SHORT";
  if (name.length > 100) return "TOO_LONG";
  const words = name.split(" ");
  if (words.length < 2 || words.length > 5) return "WORDS";
  if (!words.every((w) => WORD_RE.test(w))) return "CHARS";
  return null;
}

export const HOLDER_NAME_ERRORS: Record<HolderNameError, string> = {
  TOO_SHORT: "Укажите фамилию, имя и отчество полностью",
  TOO_LONG: "Слишком длинно — укажите только фамилию, имя и отчество",
  WORDS: "Укажите фамилию, имя и отчество (отчество — если есть)",
  CHARS: "В ФИО допустимы только буквы, дефис и апостроф",
};

/**
 * «прошёл» / «прошла» по отчеству, как в образце сертификата школы («успешно
 * прошел …»). Пол не спрашиваем — ученик вводит только ФИО; отчество его почти
 * всегда выдаёт. Без отчества (или непривычного) — нейтральное «прошёл(ла)».
 */
export function passedVerb(name: string): string {
  const words = name.toLowerCase().split(" ");
  const tail = words.slice(-2).join(" ");
  if (/(вна|чна|кызы|қызы|гызы|qizi|kizi)$/u.test(tail) || /(кызы|қызы|гызы|qizi)\b/u.test(tail)) {
    return "прошла";
  }
  if (/(вич|ич|улы|ұлы|уулу|оглы|o‘g‘li|ogli|o'g'li)$/u.test(tail)) return "прошёл";
  return "прошёл(ла)";
}

/** Номер по образцу школы: «5001/22.09.2026» (сквозной счётчик / дата выдачи). */
export function formatCertificateNumber(seq: number, issuedAt: Date): string {
  const d = issuedAt.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Minsk",
  });
  return `${seq}/${d}`;
}
