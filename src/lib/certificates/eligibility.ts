/**
 * Право на сертификат (S5.3). Чистая логика — юнит-тестируема.
 * Условие выдачи (CLAUDE.md / ТЗ): все опубликованные уроки курса пройдены
 * И итоговый экзамен сдан с результатом ≥ certificateMinScore.
 */

export interface EligibilityInput {
  totalPublishedLessons: number;
  completedLessons: number;
  examPassed: boolean;
  examScorePct: number | null;
  minScore: number;
  certificateEnabled: boolean;
}

export type IneligibleReason =
  | "CERT_DISABLED"
  | "NO_LESSONS"
  | "LESSONS_INCOMPLETE"
  | "EXAM_NOT_PASSED"
  | "SCORE_TOO_LOW";

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: IneligibleReason };

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  if (!input.certificateEnabled) return { eligible: false, reason: "CERT_DISABLED" };
  if (input.totalPublishedLessons === 0) return { eligible: false, reason: "NO_LESSONS" };
  if (input.completedLessons < input.totalPublishedLessons) {
    return { eligible: false, reason: "LESSONS_INCOMPLETE" };
  }
  if (!input.examPassed) return { eligible: false, reason: "EXAM_NOT_PASSED" };
  if ((input.examScorePct ?? 0) < input.minScore) {
    return { eligible: false, reason: "SCORE_TOO_LOW" };
  }
  return { eligible: true };
}

/** Номер сертификата вида AS-2026-000123 (год + дополненный счётчик). */
export function certificateNumber(year: number, seq: number): string {
  return `AS-${year}-${String(seq).padStart(6, "0")}`;
}
