import { describe, it, expect } from "vitest";
import {
  isEnrollmentActive,
  evaluateCourseAccess,
  evaluateLessonAccess,
  evaluateLessonUnlock,
  demoLessonCount,
  effectiveDemoPercent,
  evaluateDemoAccess,
  httpStatusForDeny,
  AccessDeniedError,
  type EnrollmentLike,
  type AccessDenyReason,
} from "./access.js";

const NOW = new Date("2026-06-12T12:00:00.000Z");
const past = (iso: string) => new Date(iso);

function enroll(overrides: Partial<EnrollmentLike> = {}): EnrollmentLike {
  return {
    startsAt: past("2026-01-01T00:00:00.000Z"),
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  };
}

// ─────────────────────────── isEnrollmentActive ───────────────────────────

describe("isEnrollmentActive", () => {
  it("активен: начался, бессрочный, не отозван", () => {
    expect(isEnrollmentActive(enroll(), NOW)).toBe(true);
  });

  it("активен: срок в будущем", () => {
    expect(
      isEnrollmentActive(enroll({ expiresAt: past("2026-12-31T00:00:00.000Z") }), NOW),
    ).toBe(true);
  });

  it("неактивен: null", () => {
    expect(isEnrollmentActive(null, NOW)).toBe(false);
    expect(isEnrollmentActive(undefined, NOW)).toBe(false);
  });

  it("неактивен: отозван", () => {
    expect(
      isEnrollmentActive(enroll({ revokedAt: past("2026-06-01T00:00:00.000Z") }), NOW),
    ).toBe(false);
  });

  it("неактивен: срок истёк", () => {
    expect(
      isEnrollmentActive(enroll({ expiresAt: past("2026-06-01T00:00:00.000Z") }), NOW),
    ).toBe(false);
  });

  it("неактивен: ещё не начался", () => {
    expect(
      isEnrollmentActive(enroll({ startsAt: past("2026-07-01T00:00:00.000Z") }), NOW),
    ).toBe(false);
  });

  it("граница: expiresAt ровно сейчас → истёк (<=)", () => {
    expect(isEnrollmentActive(enroll({ expiresAt: NOW }), NOW)).toBe(false);
  });

  it("граница: startsAt ровно сейчас → активен (начало включительно)", () => {
    expect(isEnrollmentActive(enroll({ startsAt: NOW }), NOW)).toBe(true);
  });

  it("приоритет: отозванный имеет приоритет над действующим сроком", () => {
    expect(
      isEnrollmentActive(
        enroll({
          expiresAt: past("2026-12-31T00:00:00.000Z"),
          revokedAt: past("2026-06-10T00:00:00.000Z"),
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

// ─────────────────────────── evaluateCourseAccess ───────────────────────────

describe("evaluateCourseAccess", () => {
  it("курс не найден", () => {
    expect(evaluateCourseAccess({ course: null, role: "STUDENT" })).toEqual({
      ok: false,
      reason: "COURSE_NOT_FOUND",
    });
  });

  it("OWNER видит DRAFT", () => {
    expect(
      evaluateCourseAccess({ course: { status: "DRAFT" }, role: "OWNER" }),
    ).toEqual({ ok: true });
  });

  it("OWNER видит ARCHIVED", () => {
    expect(
      evaluateCourseAccess({ course: { status: "ARCHIVED" }, role: "OWNER" }),
    ).toEqual({ ok: true });
  });

  it("STUDENT: PUBLISHED → ok", () => {
    expect(
      evaluateCourseAccess({ course: { status: "PUBLISHED" }, role: "STUDENT" }),
    ).toEqual({ ok: true });
  });

  it("STUDENT: DRAFT → отказ", () => {
    expect(
      evaluateCourseAccess({ course: { status: "DRAFT" }, role: "STUDENT" }),
    ).toEqual({ ok: false, reason: "COURSE_NOT_PUBLISHED" });
  });

  it("аноним (role null): DRAFT → отказ", () => {
    expect(
      evaluateCourseAccess({ course: { status: "DRAFT" }, role: null }),
    ).toEqual({ ok: false, reason: "COURSE_NOT_PUBLISHED" });
  });
});

// ─────────────────────────── evaluateLessonAccess ───────────────────────────

const pubCourse = { status: "PUBLISHED" as const };
const pubLesson = { status: "PUBLISHED" as const, isFreePreview: false };
const freeLesson = { status: "PUBLISHED" as const, isFreePreview: true };

describe("evaluateLessonAccess", () => {
  it("OWNER: доступ к уроку в DRAFT-курсе без enrollment", () => {
    expect(
      evaluateLessonAccess({
        course: { status: "DRAFT" },
        lesson: { status: "DRAFT", isFreePreview: false },
        enrollment: null,
        role: "OWNER",
        now: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it("бесплатное превью: доступно без enrollment", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: freeLesson,
        enrollment: null,
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it("платный урок с активным enrollment → ok", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: pubLesson,
        enrollment: enroll(),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it("платный урок без enrollment → NO_ENROLLMENT", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: pubLesson,
        enrollment: null,
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "NO_ENROLLMENT" });
  });

  it("отозванный доступ → ENROLLMENT_REVOKED", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: pubLesson,
        enrollment: enroll({ revokedAt: past("2026-06-01T00:00:00.000Z") }),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "ENROLLMENT_REVOKED" });
  });

  it("истёкший доступ → ENROLLMENT_EXPIRED", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: pubLesson,
        enrollment: enroll({ expiresAt: past("2026-06-01T00:00:00.000Z") }),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "ENROLLMENT_EXPIRED" });
  });

  it("доступ ещё не начался → ENROLLMENT_NOT_STARTED", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: pubLesson,
        enrollment: enroll({ startsAt: past("2026-07-01T00:00:00.000Z") }),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "ENROLLMENT_NOT_STARTED" });
  });

  it("DRAFT-курс для STUDENT → COURSE_NOT_PUBLISHED (даже с enrollment)", () => {
    expect(
      evaluateLessonAccess({
        course: { status: "DRAFT" },
        lesson: pubLesson,
        enrollment: enroll(),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "COURSE_NOT_PUBLISHED" });
  });

  it("DRAFT-урок в опубликованном курсе для STUDENT → LESSON_NOT_PUBLISHED", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: { status: "DRAFT", isFreePreview: false },
        enrollment: enroll(),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "LESSON_NOT_PUBLISHED" });
  });

  it("DRAFT-урок, помеченный free preview, всё равно скрыт для STUDENT", () => {
    expect(
      evaluateLessonAccess({
        course: pubCourse,
        lesson: { status: "DRAFT", isFreePreview: true },
        enrollment: null,
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "LESSON_NOT_PUBLISHED" });
  });

  it("курс не найден → COURSE_NOT_FOUND", () => {
    expect(
      evaluateLessonAccess({
        course: null,
        lesson: pubLesson,
        enrollment: enroll(),
        role: "STUDENT",
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "COURSE_NOT_FOUND" });
  });

  it("порядок проверок: курс не опубликован важнее отсутствия enrollment", () => {
    const r = evaluateLessonAccess({
      course: { status: "DRAFT" },
      lesson: pubLesson,
      enrollment: null,
      role: "STUDENT",
      now: NOW,
    });
    expect(r).toEqual({ ok: false, reason: "COURSE_NOT_PUBLISHED" });
  });
});

// ─────────────────────────── evaluateLessonUnlock ───────────────────────────

describe("evaluateLessonUnlock", () => {
  const lessons = [
    { id: "l1", requiresQuizPass: true },
    { id: "l2", requiresQuizPass: false },
    { id: "l3", requiresQuizPass: true },
    { id: "l4", requiresQuizPass: false },
  ];

  it("первый урок всегда открыт", () => {
    expect(
      evaluateLessonUnlock({
        orderedLessons: lessons,
        isQuizPassed: () => false,
        targetLessonId: "l1",
      }),
    ).toEqual({ ok: true });
  });

  it("второй урок закрыт, пока не сдан тест первого (requiresQuizPass)", () => {
    expect(
      evaluateLessonUnlock({
        orderedLessons: lessons,
        isQuizPassed: () => false,
        targetLessonId: "l2",
      }),
    ).toEqual({ ok: false, reason: "PREREQUISITE_NOT_MET" });
  });

  it("второй урок открыт после сдачи теста первого", () => {
    expect(
      evaluateLessonUnlock({
        orderedLessons: lessons,
        isQuizPassed: (id) => id === "l1",
        targetLessonId: "l2",
      }),
    ).toEqual({ ok: true });
  });

  it("четвёртый урок требует сдачи тестов l1 и l3", () => {
    expect(
      evaluateLessonUnlock({
        orderedLessons: lessons,
        isQuizPassed: (id) => id === "l1",
        targetLessonId: "l4",
      }),
    ).toEqual({ ok: false, reason: "PREREQUISITE_NOT_MET" });

    expect(
      evaluateLessonUnlock({
        orderedLessons: lessons,
        isQuizPassed: (id) => id === "l1" || id === "l3",
        targetLessonId: "l4",
      }),
    ).toEqual({ ok: true });
  });

  it("урок не из курса → LESSON_NOT_FOUND", () => {
    expect(
      evaluateLessonUnlock({
        orderedLessons: lessons,
        isQuizPassed: () => true,
        targetLessonId: "nope",
      }),
    ).toEqual({ ok: false, reason: "LESSON_NOT_FOUND" });
  });

  it("курс без requiresQuizPass-гейтов — все уроки открыты", () => {
    const open = [
      { id: "a", requiresQuizPass: false },
      { id: "b", requiresQuizPass: false },
    ];
    expect(
      evaluateLessonUnlock({
        orderedLessons: open,
        isQuizPassed: () => false,
        targetLessonId: "b",
      }),
    ).toEqual({ ok: true });
  });
});

// ─────────────────────────── httpStatusForDeny / AccessDeniedError ───────────────────────────

describe("httpStatusForDeny", () => {
  it.each<[AccessDenyReason, 403 | 404]>([
    ["COURSE_NOT_FOUND", 404],
    ["COURSE_NOT_PUBLISHED", 404],
    ["LESSON_NOT_FOUND", 404],
    ["LESSON_NOT_PUBLISHED", 404],
    ["NO_ENROLLMENT", 403],
    ["ENROLLMENT_REVOKED", 403],
    ["ENROLLMENT_EXPIRED", 403],
    ["ENROLLMENT_NOT_STARTED", 403],
    ["PREREQUISITE_NOT_MET", 403],
    ["DEMO_LIMIT", 403],
  ])("%s → %i", (reason, status) => {
    expect(httpStatusForDeny(reason)).toBe(status);
  });
});

describe("AccessDeniedError", () => {
  it("несёт reason и корректный HTTP-код", () => {
    const err = new AccessDeniedError("NO_ENROLLMENT");
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe("NO_ENROLLMENT");
    expect(err.status).toBe(403);
    expect(err.name).toBe("AccessDeniedError");
  });

  it("для «не найдено» отдаёт 404", () => {
    expect(new AccessDeniedError("LESSON_NOT_PUBLISHED").status).toBe(404);
  });
});


// ─────────────────────────── Демо-доступ ───────────────────────────

describe("demoLessonCount", () => {
  it("округляет вниз: демо не даёт больше обещанного", () => {
    expect(demoLessonCount(33, 30)).toBe(9); // 9.9 → 9
    expect(demoLessonCount(10, 25)).toBe(2); // 2.5 → 2
  });

  it("при percent > 0 открывает хотя бы один урок", () => {
    expect(demoLessonCount(3, 30)).toBe(1); // 0.9 → 1, а не пустой кабинет
    expect(demoLessonCount(100, 1)).toBe(1);
  });

  it("0 закрывает курс целиком, 100 открывает весь", () => {
    expect(demoLessonCount(33, 0)).toBe(0);
    expect(demoLessonCount(33, 100)).toBe(33);
  });

  it("значения за границами диапазона зажимаются", () => {
    expect(demoLessonCount(20, -10)).toBe(0);
    expect(demoLessonCount(20, 150)).toBe(20);
  });

  it("курс без опубликованных уроков — открывать нечего", () => {
    expect(demoLessonCount(0, 50)).toBe(0);
  });

  it("состав демо пересчитывается при доборе уроков курса", () => {
    expect(demoLessonCount(10, 30)).toBe(3);
    expect(demoLessonCount(20, 30)).toBe(6); // фабрика добавила уроки — граница сдвинулась
  });
});

describe("effectiveDemoPercent", () => {
  it("без значений — полный доступ", () => {
    expect(
      effectiveDemoPercent({ enrollmentPercent: null, licensePercent: null }),
    ).toBeNull();
  });

  it("лицензия задаёт лимит всем местам", () => {
    expect(
      effectiveDemoPercent({ enrollmentPercent: null, licensePercent: 30 }),
    ).toBe(30);
  });

  it("значение места перекрывает лицензионное", () => {
    expect(effectiveDemoPercent({ enrollmentPercent: 50, licensePercent: 30 })).toBe(50);
  });

  it("ноль на месте — это лимит, а не «не задано»", () => {
    expect(effectiveDemoPercent({ enrollmentPercent: 0, licensePercent: 30 })).toBe(0);
  });
});

describe("evaluateDemoAccess", () => {
  const ids = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10"];

  it("без процента доступ полный", () => {
    expect(
      evaluateDemoAccess({ orderedLessonIds: ids, targetLessonId: "l10", percent: null }),
    ).toEqual({ ok: true });
  });

  it("открывает первые N% уроков в порядке прохождения", () => {
    expect(
      evaluateDemoAccess({ orderedLessonIds: ids, targetLessonId: "l3", percent: 30 }),
    ).toEqual({ ok: true });
  });

  it("следующий за границей урок закрыт с DEMO_LIMIT", () => {
    expect(
      evaluateDemoAccess({ orderedLessonIds: ids, targetLessonId: "l4", percent: 30 }),
    ).toEqual({ ok: false, reason: "DEMO_LIMIT" });
  });

  it("percent = 0 закрывает даже первый урок", () => {
    expect(
      evaluateDemoAccess({ orderedLessonIds: ids, targetLessonId: "l1", percent: 0 }),
    ).toEqual({ ok: false, reason: "DEMO_LIMIT" });
  });

  it("урока нет среди опубликованных — решает не демо-логика", () => {
    expect(
      evaluateDemoAccess({ orderedLessonIds: ids, targetLessonId: "ghost", percent: 10 }),
    ).toEqual({ ok: true });
  });
});
