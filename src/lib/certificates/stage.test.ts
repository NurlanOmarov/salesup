import { describe, it, expect } from "vitest";
import { finishStage, type FinishStageInput } from "./stage.js";

const base: FinishStageInput = {
  totalLessons: 3,
  completedLessons: 3,
  examId: "exam1",
  examPassed: false,
  certificateEnabled: true,
  demo: false,
  certificate: null,
  reviewed: false,
};

describe("finishStage", () => {
  it("уроки не пройдены → learning", () => {
    expect(finishStage({ ...base, completedLessons: 2 })).toEqual({ kind: "learning" });
  });

  it("курс без уроков → learning", () => {
    expect(finishStage({ ...base, totalLessons: 0, completedLessons: 0 })).toEqual({ kind: "learning" });
  });

  it("уроки пройдены, экзамен не сдан → exam", () => {
    expect(finishStage(base)).toEqual({ kind: "exam", examId: "exam1" });
  });

  it("экзамен сдан, но сертификата нет (балл ниже порога курса) → exam", () => {
    expect(finishStage({ ...base, examPassed: true })).toEqual({ kind: "exam", examId: "exam1" });
  });

  it("сертификат готов, отзыва нет → review", () => {
    expect(finishStage({ ...base, examPassed: true, certificate: { status: "READY" } })).toEqual({
      kind: "review",
    });
  });

  it("сертификат готов, отзыв оставлен → request", () => {
    expect(
      finishStage({ ...base, examPassed: true, certificate: { status: "READY" }, reviewed: true }),
    ).toEqual({ kind: "request" });
  });

  it("сертификат выдан → issued", () => {
    expect(finishStage({ ...base, certificate: { status: "ISSUED" }, reviewed: true })).toEqual({
      kind: "issued",
    });
  });

  it("сертификат у курса выключен / нет экзамена / демо → done", () => {
    expect(finishStage({ ...base, certificateEnabled: false })).toEqual({ kind: "done" });
    expect(finishStage({ ...base, examId: null })).toEqual({ kind: "done" });
    expect(finishStage({ ...base, demo: true })).toEqual({ kind: "done" });
  });
});
