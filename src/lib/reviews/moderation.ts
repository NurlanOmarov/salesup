/**
 * Автомодерация отзывов учеников (CLAUDE.md, правило 5: человеческой модерации
 * не существует). Отзыв — пользовательский текст, а не сгенерированный контент,
 * поэтому AI-критик здесь не нужен: достаточно детерминированных правил, которые
 * отсекают спам, чужие контакты и пустые «норм».
 *
 * VALIDATED — публикуется на странице курса сразу; PENDING — остаётся владельцу
 * в /admin/reviews (сомнительный текст); FAILED — явный спам.
 */
import type { ValidationStatus } from "@prisma/client";

/** Минимальная осмысленная длина: «Спасибо!» отзывом не считается. */
const MIN_LENGTH = 40;
const MAX_LENGTH = 2000;

/** Ссылки и контакты: типичный спам «купите у нас», уводящий с площадки. */
const CONTACT_RE =
  /(https?:\/\/|www\.|t\.me\/|wa\.me\/|@[a-z0-9_]{4,}|\+?\d[\d\s().-]{8,}\d)/i;

/** Грубая брань — публиковать нельзя даже в положительном отзыве. */
const PROFANITY_RE =
  /(?:^|[^а-яё])(?:х[уy][йиеёяю]|п[иi]зд|[её]б[ауеиывтлн]|бля[дт]?|муд[аои]|сук[аи]\b|гандон|пидор|заеб)/i;

/** Повторяющийся мусор: «ааааа», «!!!!!!», один символ на весь отзыв. */
function isGibberish(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < MIN_LENGTH / 2) return true;
  if (/(.)\1{6,}/u.test(text)) return true;
  const unique = new Set(letters.toLowerCase()).size;
  return unique < 8;
}

export interface ModerationResult {
  status: ValidationStatus;
  /** Причина для владельца в /admin/reviews; null — вопросов нет. */
  note: string | null;
}

export function moderateReview(text: string): ModerationResult {
  const value = text.trim();
  if (value.length < MIN_LENGTH) {
    return { status: "PENDING", note: "Короткий отзыв — проверьте вручную" };
  }
  if (value.length > MAX_LENGTH) {
    return { status: "PENDING", note: "Слишком длинный отзыв" };
  }
  if (PROFANITY_RE.test(value)) {
    return { status: "FAILED", note: "Ненормативная лексика" };
  }
  if (CONTACT_RE.test(value)) {
    return { status: "PENDING", note: "Ссылка или контакт в тексте" };
  }
  if (isGibberish(value)) {
    return { status: "FAILED", note: "Бессмысленный текст" };
  }
  return { status: "VALIDATED", note: null };
}
