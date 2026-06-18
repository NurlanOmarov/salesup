import { describe, it, expect } from "vitest";
import { buildDailyQuests, questsCompleted } from "./quests";

/** Сборка дневных целей: прогресс клампится, done по достижению target. */
describe("buildDailyQuests", () => {
  it("отмечает выполненные и клампит прогресс", () => {
    const q = buildDailyQuests({ lessons: 2, reviews: 5, practice: 0 });
    const lesson = q.find((x) => x.key === "lesson")!;
    const review = q.find((x) => x.key === "review")!;
    const practice = q.find((x) => x.key === "practice")!;
    expect(lesson.done).toBe(true);
    expect(lesson.current).toBe(1); // кламп к target=1
    expect(review.done).toBe(true);
    expect(practice.done).toBe(false);
    expect(practice.current).toBe(0);
  });

  it("частичный прогресс по карточкам", () => {
    const review = buildDailyQuests({ lessons: 0, reviews: 3, practice: 0 }).find((x) => x.key === "review")!;
    expect(review.current).toBe(3);
    expect(review.target).toBe(5);
    expect(review.done).toBe(false);
  });

  it("questsCompleted считает выполненные", () => {
    const q = buildDailyQuests({ lessons: 1, reviews: 5, practice: 0 });
    expect(questsCompleted(q)).toEqual({ done: 2, total: 3 });
  });

  it("пустой день — ничего не выполнено", () => {
    const q = buildDailyQuests({ lessons: 0, reviews: 0, practice: 0 });
    expect(questsCompleted(q)).toEqual({ done: 0, total: 3 });
  });
});
