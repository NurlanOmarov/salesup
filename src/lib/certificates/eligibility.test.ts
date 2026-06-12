import { describe, it, expect } from "vitest";
import { checkEligibility, certificateNumber } from "./eligibility.js";

const base = {
  totalPublishedLessons: 5,
  completedLessons: 5,
  examPassed: true,
  examScorePct: 90,
  minScore: 80,
  certificateEnabled: true,
};

describe("checkEligibility", () => {
  it("все условия выполнены → eligible", () => {
    expect(checkEligibility(base)).toEqual({ eligible: true });
  });

  it("сертификаты отключены у курса", () => {
    expect(checkEligibility({ ...base, certificateEnabled: false })).toEqual({
      eligible: false,
      reason: "CERT_DISABLED",
    });
  });

  it("в курсе нет опубликованных уроков", () => {
    expect(checkEligibility({ ...base, totalPublishedLessons: 0 })).toEqual({
      eligible: false,
      reason: "NO_LESSONS",
    });
  });

  it("пройдены не все уроки", () => {
    expect(checkEligibility({ ...base, completedLessons: 3 })).toEqual({
      eligible: false,
      reason: "LESSONS_INCOMPLETE",
    });
  });

  it("экзамен не сдан", () => {
    expect(checkEligibility({ ...base, examPassed: false })).toEqual({
      eligible: false,
      reason: "EXAM_NOT_PASSED",
    });
  });

  it("балл ниже порога (даже если passed-флаг стоит)", () => {
    expect(checkEligibility({ ...base, examScorePct: 70 })).toEqual({
      eligible: false,
      reason: "SCORE_TOO_LOW",
    });
  });

  it("балл null → как 0, ниже порога", () => {
    expect(checkEligibility({ ...base, examScorePct: null }).eligible).toBe(false);
  });

  it("ровно на пороге → eligible", () => {
    expect(checkEligibility({ ...base, examScorePct: 80 }).eligible).toBe(true);
  });

  it("приоритет причин: отключённые сертификаты важнее незавершённых уроков", () => {
    const r = checkEligibility({
      ...base,
      certificateEnabled: false,
      completedLessons: 0,
    });
    expect(r).toEqual({ eligible: false, reason: "CERT_DISABLED" });
  });
});

describe("certificateNumber", () => {
  it("форматирует с дополнением нулями", () => {
    expect(certificateNumber(2026, 123)).toBe("AS-2026-000123");
  });
  it("большой счётчик", () => {
    expect(certificateNumber(2026, 1234567)).toBe("AS-2026-1234567");
  });
});
