import { describe, it, expect } from "vitest";
import {
  PRACTICE_KINDS,
  TRAINER_ARTIFACT_TYPES,
  isPracticeKind,
  pickMainTrainer,
  toScorePct,
} from "./practice";

describe("pickMainTrainer", () => {
  it("выбирает игру по приоритету, а не карточки", () => {
    expect(pickMainTrainer(["FLASHCARDS", "DIALOGUE_AUDIT", "STAGE_LADDER"])).toBe("STAGE_LADDER");
    expect(pickMainTrainer(["FLASHCARDS", "CLIENT_TYPES", "DIALOGUE_AUDIT"])).toBe("CLIENT_TYPES");
  });

  it("карточки и схема — главными только если больше нечего", () => {
    expect(pickMainTrainer(["HOTSPOT", "FLASHCARDS"])).toBe("FLASHCARDS");
    expect(pickMainTrainer(["HOTSPOT"])).toBe("HOTSPOT");
  });

  it("нет тренажёров — null", () => {
    expect(pickMainTrainer([])).toBeNull();
  });
});

describe("toScorePct", () => {
  it("округляет долю и держит границы", () => {
    expect(toScorePct(2, 3)).toBe(67);
    expect(toScorePct(5, 4)).toBe(100);
    expect(toScorePct(-1, 4)).toBe(0);
  });

  it("без знаменателя — null", () => {
    expect(toScorePct(0, 0)).toBeNull();
  });
});

describe("словарь видов", () => {
  it("артефакты-тренажёры — это виды без производных RAPID_FIRE/SIMULATION", () => {
    expect(TRAINER_ARTIFACT_TYPES).not.toContain("RAPID_FIRE");
    expect(TRAINER_ARTIFACT_TYPES).not.toContain("SIMULATION");
    expect(TRAINER_ARTIFACT_TYPES.length).toBe(PRACTICE_KINDS.length - 2);
  });

  it("CHECKLIST — памятка, а не тренажёр", () => {
    expect(isPracticeKind("CHECKLIST")).toBe(false);
    expect(isPracticeKind("STAGE_LADDER")).toBe(true);
  });
});
