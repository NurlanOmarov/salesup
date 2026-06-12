/**
 * Вычисление прогресса по курсу из плоского списка уроков (S4.2). Чистые функции,
 * без БД — юнит-тестируемы. «Пройден» = есть completedAt в LessonProgress.
 */

export interface LessonProgressLike {
  id: string;
  completed: boolean;
}

export interface CourseProgress {
  total: number;
  completed: number;
  percent: number; // 0–100, округлён вниз
}

export function courseProgress(lessons: LessonProgressLike[]): CourseProgress {
  const total = lessons.length;
  const completed = lessons.filter((l) => l.completed).length;
  const percent = total === 0 ? 0 : Math.floor((completed / total) * 100);
  return { total, completed, percent };
}

/**
 * Следующий урок для «Продолжить обучение»: первый непройденный по порядку,
 * иначе (всё пройдено или пусто) — первый урок, иначе null.
 */
export function nextLesson<T extends LessonProgressLike>(lessons: T[]): T | null {
  if (lessons.length === 0) return null;
  return lessons.find((l) => !l.completed) ?? lessons[0] ?? null;
}
