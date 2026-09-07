/**
 * Определение курса по тексту заказа (docs/ALFA-PAYMENT-LINKS.md §2.7).
 *
 * Платёжная ссылка знает, за какой курс платят, но пользовательские параметры
 * ссылки в callback-уведомление не попадают: список дополнительных параметров
 * в кабинете фиксирован. Зато туда попадают `orderDescription` и `name` —
 * описание и название ссылки. Поэтому курс ищем в них:
 *
 *   1. по адресу курса (`sales-spin`) — если он вписан в описание ссылки;
 *   2. по точному названию курса — если описание не содержит адреса.
 *
 * Первый способ надёжнее и рекомендован инструкцией: адрес курса не меняется,
 * а название владелец может переписать в любой момент.
 */

export interface CourseCandidate {
  slug: string;
  title: string;
}

/** Убираем регистр, пунктуацию и двойные пробелы — сравнивать нужно по смыслу. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"'`.,:;!?()[\]{}—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Курс, за который заплатили, или null. `texts` — описание и название заказа
 * из уведомления в любом порядке.
 */
export function matchCourseFromText(
  texts: Array<string | null | undefined>,
  courses: CourseCandidate[],
): CourseCandidate | null {
  const joined = texts.filter(Boolean).join(" \n ");
  if (!joined.trim()) return null;

  // 1. Адрес курса как отдельное слово: «Код курса: sales-spin».
  //    Ищем в исходном тексте — slug состоит из латиницы, дефисов и цифр.
  for (const course of courses) {
    const pattern = new RegExp(`(^|[^a-z0-9-])${course.slug}([^a-z0-9-]|$)`, "i");
    if (pattern.test(joined)) return course;
  }

  // 2. Название курса целиком. Берём самое длинное совпадение: названия курсов
  //    могут вкладываться друг в друга, и выиграть должно более точное.
  const haystack = normalize(joined);
  let best: CourseCandidate | null = null;
  for (const course of courses) {
    const title = normalize(course.title);
    if (title.length >= 8 && haystack.includes(title)) {
      if (!best || course.title.length > best.title.length) best = course;
    }
  }
  return best;
}
