import { describe, expect, it } from "vitest";
import { orgAdminSetupSteps, ownerSetupSteps, type OrgSetupState } from "./setup";

const EMPTY: OrgSetupState = {
  licenses: 0,
  seatsTotal: 0,
  admins: 0,
  adminSignedIn: false,
  learners: 0,
  learnersSignedIn: 0,
  namesConfigured: false,
};

const READY: OrgSetupState = {
  licenses: 1,
  seatsTotal: 10,
  admins: 1,
  adminSignedIn: true,
  learners: 3,
  learnersSignedIn: 3,
  namesConfigured: false,
};

describe("шаги запуска клиента", () => {
  it("у нового клиента не закрыт ни один обязательный шаг", () => {
    const steps = ownerSetupSteps(EMPTY, "org1", { hasRequisites: false });
    expect(steps.filter((s) => !s.optional).every((s) => !s.done)).toBe(true);
  });

  it("шаг закрывается тем, что сделал клиент сам: работники заведены — шаг владельца готов", () => {
    const steps = ownerSetupSteps({ ...EMPTY, learners: 2 }, "org1", { hasRequisites: false });
    expect(steps.find((s) => s.key === "members")?.done).toBe(true);
  });

  it("передача доступа считается выполненной только после входа ответственного", () => {
    const created = ownerSetupSteps({ ...EMPTY, admins: 1 }, "org1", { hasRequisites: false });
    expect(created.find((s) => s.key === "admin")?.done).toBe(true);
    expect(created.find((s) => s.key === "handover")?.done).toBe(false);

    const signedIn = ownerSetupSteps(
      { ...EMPTY, admins: 1, adminSignedIn: true },
      "org1",
      { hasRequisites: false },
    );
    expect(signedIn.find((s) => s.key === "handover")?.done).toBe(true);
  });

  it("у запущенного клиента все обязательные шаги владельца закрыты", () => {
    const steps = ownerSetupSteps(READY, "org1", { hasRequisites: true });
    expect(steps.filter((s) => !s.optional).every((s) => s.done)).toBe(true);
  });

  it("шаги ответственного ведут только в его же кабинет", () => {
    const steps = orgAdminSetupSteps(READY, "org1");
    for (const step of steps) expect(step.href?.startsWith("/org/org1")).toBe(true);
    expect(steps.every((s) => s.href)).toBe(true);
  });

  it("без лицензий шаг про места никуда не ведёт: идти клиенту некуда", () => {
    const steps = orgAdminSetupSteps(EMPTY, "org1");
    expect(steps.find((s) => s.key === "license")?.href).toBeUndefined();
  });

  it("раздача доступов закрывается только входом работника, а не созданием учёток", () => {
    // Созданные учётки ещё ничего не значат: логины могли остаться в браузере
    // ответственного и никому не уйти.
    const created = orgAdminSetupSteps({ ...EMPTY, learners: 3 }, "org1");
    expect(created.find((s) => s.key === "members")?.done).toBe(true);
    expect(created.find((s) => s.key === "handout")?.done).toBe(false);

    const signedIn = orgAdminSetupSteps(
      { ...EMPTY, learners: 3, learnersSignedIn: 1 },
      "org1",
    );
    expect(signedIn.find((s) => s.key === "handout")?.done).toBe(true);
  });

  it("имена работников — необязательный шаг: без него настройка считается завершённой", () => {
    const steps = orgAdminSetupSteps(READY, "org1");
    expect(steps.find((s) => s.key === "names")?.optional).toBe(true);
    expect(steps.filter((s) => !s.optional).every((s) => s.done)).toBe(true);
  });
});
