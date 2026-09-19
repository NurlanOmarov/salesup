import { describe, expect, it } from "vitest";
import { planProvision, seatsToProvision } from "./provision";

const learner = (userId: string, ...courseIds: string[]) => ({
  userId,
  courseIds: new Set(courseIds),
});

describe("planProvision", () => {
  it("на пустой организации создаёт столько учёток, сколько мест", () => {
    const plan = planProvision([], [{ licenseId: "L1", courseId: "C1", count: 3 }]);
    expect(plan.reuse).toEqual([]);
    expect(plan.fresh).toHaveLength(3);
    expect(plan.fresh.every((f) => f.licenseIds.join() === "L1")).toBe(true);
  });

  it("вторая лицензия садит людей на уже созданные учётки, а не плодит новые", () => {
    const plan = planProvision(
      [],
      [
        { licenseId: "L1", courseId: "C1", count: 3 },
        { licenseId: "L2", courseId: "C2", count: 3 },
      ],
    );
    expect(plan.fresh).toHaveLength(3);
    expect(plan.fresh.every((f) => f.licenseIds.join() === "L1,L2")).toBe(true);
  });

  it("сначала занимает существующих работников без этого курса", () => {
    const plan = planProvision(
      [learner("u1", "C1"), learner("u2", "C1")],
      [{ licenseId: "L2", courseId: "C2", count: 3 }],
    );
    expect(plan.reuse).toEqual([
      { userId: "u1", licenseIds: ["L2"] },
      { userId: "u2", licenseIds: ["L2"] },
    ]);
    expect(plan.fresh).toEqual([{ licenseIds: ["L2"] }]);
  });

  it("не трогает работника, у которого курс уже есть (в том числе отозванный)", () => {
    const plan = planProvision([learner("u1", "C1")], [{ licenseId: "L1", courseId: "C1", count: 1 }]);
    expect(plan.reuse).toEqual([]);
    expect(plan.fresh).toHaveLength(1);
  });

  it("разные объёмы мест: библиотека 2 курса, на втором мест больше", () => {
    const plan = planProvision(
      [],
      [
        { licenseId: "L1", courseId: "C1", count: 2 },
        { licenseId: "L2", courseId: "C2", count: 5 },
      ],
    );
    // 2 учётки с двумя курсами и 3 — только со вторым.
    expect(plan.fresh).toHaveLength(5);
    expect(plan.fresh.filter((f) => f.licenseIds.length === 2)).toHaveLength(2);
    expect(plan.fresh.filter((f) => f.licenseIds.length === 1)).toHaveLength(3);
  });

  it("нулевое и отрицательное число мест ничего не создаёт", () => {
    expect(planProvision([], [{ licenseId: "L1", courseId: "C1", count: 0 }])).toEqual({
      reuse: [],
      fresh: [],
    });
    expect(planProvision([], [{ licenseId: "L1", courseId: "C1", count: -4 }]).fresh).toHaveLength(0);
  });
});

describe("seatsToProvision", () => {
  it("новая лицензия — все места", () => {
    expect(seatsToProvision({ previousSeatsTotal: null, seatsTotal: 10 })).toBe(10);
  });

  it("расширение — только прирост", () => {
    expect(seatsToProvision({ previousSeatsTotal: 10, seatsTotal: 15 })).toBe(5);
  });

  it("сохранение без изменений и уменьшение не создают учёток", () => {
    expect(seatsToProvision({ previousSeatsTotal: 10, seatsTotal: 10 })).toBe(0);
    expect(seatsToProvision({ previousSeatsTotal: 10, seatsTotal: 4 })).toBe(0);
  });
});
