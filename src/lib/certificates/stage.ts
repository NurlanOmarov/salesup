/**
 * На каком шаге к сертификату находится ученик по курсу. Чистая логика — одна на
 * кабинет, страницу урока и экран результата, чтобы все они вели в одно место.
 *
 * Путь: уроки → итоговый экзамен → сертификат «Готов к получению» → отзыв →
 * запрос сертификата (ФИО на почту / через ответственного) → «Выдан».
 * Раньше после уроков никто не подсказывал следующий шаг: кабинет звал обратно
 * на первый урок, и ученики останавливались, не дойдя ни до экзамена, ни до отзыва.
 */

export type FinishStage =
  /** Уроки ещё не пройдены — обычное «Продолжить». */
  | { kind: "learning" }
  /** Уроки пройдены, осталось сдать итоговый экзамен. */
  | { kind: "exam"; examId: string }
  /** Сертификат готов, нужен отзыв (шаг 1 на странице сертификатов). */
  | { kind: "review" }
  /** Отзыв оставлен, осталось запросить сертификат (шаг 2). */
  | { kind: "request" }
  /** Сертификат выдан. */
  | { kind: "issued" }
  /** Уроки пройдены, но сертификата у курса нет (выключен, нет экзамена, демо). */
  | { kind: "done" };

export interface FinishStageInput {
  totalLessons: number;
  completedLessons: number;
  examId: string | null;
  examPassed: boolean;
  certificateEnabled: boolean;
  /** Демо-доступ: экзамен и сертификат закрыты. */
  demo: boolean;
  certificate: { status: "READY" | "ISSUED" | string } | null;
  reviewed: boolean;
}

export function finishStage(input: FinishStageInput): FinishStage {
  if (input.certificate) {
    if (input.certificate.status === "ISSUED") return { kind: "issued" };
    return input.reviewed ? { kind: "request" } : { kind: "review" };
  }
  if (input.totalLessons === 0 || input.completedLessons < input.totalLessons) {
    return { kind: "learning" };
  }
  if (input.demo || !input.certificateEnabled || !input.examId) return { kind: "done" };
  // Экзамен сдан, а сертификата нет — балл ниже порога сертификата курса
  // (certificateMinScore выше проходного): экзамен нужно пересдать.
  return { kind: "exam", examId: input.examId };
}
