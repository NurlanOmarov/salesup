import type { Locale } from "@/i18n/routing";
import { DEFAULT_LOCALE, type ExtraLocale } from "@/i18n/routing";

/**
 * Витринные тексты курса на языке страницы.
 *
 * Русский лежит в самой модели Course, переводы — в CourseTranslation. Пустое
 * поле перевода наследует русское значение: половина переведённой карточки
 * лучше, чем дыра, а «переведено ли достаточно для индексации» решает
 * isCourseTranslated().
 *
 * ВАЖНО: перевод касается только витрины. Видео, конспекты и тесты остаются
 * русскими, поэтому на карточке всегда показывается язык курса и список
 * субтитров — чтобы переведённое название не обещало русскоязычного урока
 * на другом языке.
 */
export interface CourseTexts {
  title: string;
  subtitle: string | null;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface CourseTranslationRow {
  locale: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** Перевод курса на язык страницы; для русского и без перевода — исходные тексты. */
export function localizedCourse<T extends CourseTexts>(
  course: T & { translations?: CourseTranslationRow[] },
  locale: Locale,
): T {
  if (locale === DEFAULT_LOCALE) return course;
  const t = course.translations?.find((x) => x.locale === locale);
  if (!t) return course;
  return {
    ...course,
    title: t.title || course.title,
    subtitle: t.subtitle || course.subtitle,
    description: t.description || course.description,
    seoTitle: t.seoTitle || course.seoTitle,
    seoDescription: t.seoDescription || course.seoDescription,
  };
}

/**
 * Достаточно ли переведена карточка, чтобы отдавать её поисковику как страницу
 * на этом языке. Название и описание — то, что читает и индексирует поисковик;
 * без описания страница остаётся преимущественно русской, и мы канонизируем её
 * на русский адрес (src/lib/seo/site-hosts.ts).
 */
export function isCourseTranslated(
  translations: CourseTranslationRow[] | undefined,
  locale: Locale,
): boolean {
  if (locale === DEFAULT_LOCALE) return true;
  const t = translations?.find((x) => x.locale === locale);
  return Boolean(t?.title && t?.description);
}

/**
 * Короткая версия для карточки каталога: там из текстов только название и
 * подзаголовок, описание не показывается.
 */
export function localizedCard<
  T extends { title: string; subtitle: string | null; translations?: CourseTranslationRow[] },
>(card: T, locale: Locale): { title: string; subtitle: string | null } {
  if (locale === DEFAULT_LOCALE) return { title: card.title, subtitle: card.subtitle };
  const t = card.translations?.find((x) => x.locale === locale);
  return {
    title: t?.title || card.title,
    subtitle: t?.subtitle || card.subtitle,
  };
}

/** Языки, на которые карточка переведена достаточно для индексации. */
export function translatedLocales(
  translations: CourseTranslationRow[] | undefined,
): ExtraLocale[] {
  return (translations ?? [])
    .filter((t) => t.title && t.description)
    .map((t) => t.locale)
    .filter((l): l is ExtraLocale => l === "kk" || l === "uz");
}
