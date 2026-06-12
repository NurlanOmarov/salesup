import type { PublishStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * ЕДИНСТВЕННОЕ место проверки доступа к контенту (CLAUDE.md, правило 1).
 * Любой код проекта — RSC, Server Actions, video-API — спрашивает доступ
 * только здесь. Прямые проверки enrollment/publish в других местах запрещены.
 *
 * Архитектура: чистые `evaluate*`-функции (без БД, полностью юнит-тестируемы)
 * + тонкие БД-обёртки `canAccess*`/`assert*`, которые грузят данные и делегируют
 * чистой логике. Результат — discriminated union с причиной отказа, чтобы вызов
 * мог отдать корректный HTTP-код (404 для «не найдено/не опубликовано», 403 для
 * «нет доступа») и не протекала информация о существовании скрытого контента.
 */

// ─────────────────────────── Типы результата ───────────────────────────

export type AccessDenyReason =
  | "COURSE_NOT_FOUND"
  | "COURSE_NOT_PUBLISHED"
  | "LESSON_NOT_FOUND"
  | "LESSON_NOT_PUBLISHED"
  | "NO_ENROLLMENT"
  | "ENROLLMENT_REVOKED"
  | "ENROLLMENT_EXPIRED"
  | "ENROLLMENT_NOT_STARTED"
  | "PREREQUISITE_NOT_MET";

export type AccessResult =
  | { ok: true }
  | { ok: false; reason: AccessDenyReason };

const ALLOW: AccessResult = { ok: true };
const deny = (reason: AccessDenyReason): AccessResult => ({ ok: false, reason });

/** Причины, которые во внешнем API маппятся в 404 (а не 403): не раскрываем
 *  существование неопубликованного/скрытого контента посторонним. */
const NOT_FOUND_REASONS: ReadonlySet<AccessDenyReason> = new Set([
  "COURSE_NOT_FOUND",
  "COURSE_NOT_PUBLISHED",
  "LESSON_NOT_FOUND",
  "LESSON_NOT_PUBLISHED",
]);

/** HTTP-код для причины отказа: 404 для «не найдено», иначе 403. */
export function httpStatusForDeny(reason: AccessDenyReason): 403 | 404 {
  return NOT_FOUND_REASONS.has(reason) ? 404 : 403;
}

// ─────────────────────────── Входные данные (чистая логика) ───────────────────────────

/** Минимальный срез enrollment, нужный для проверки активности. */
export interface EnrollmentLike {
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface CourseLike {
  status: PublishStatus;
}

export interface LessonLike {
  status: PublishStatus;
  isFreePreview: boolean;
}

// ─────────────────────────── Чистая логика ───────────────────────────

/**
 * Активен ли доступ на момент `now`: не отозван, начался и не истёк.
 * `expiresAt = null` означает бессрочный (LIFETIME).
 */
export function isEnrollmentActive(
  enrollment: EnrollmentLike | null | undefined,
  now: Date,
): boolean {
  if (!enrollment) return false;
  if (enrollment.revokedAt !== null) return false;
  if (enrollment.startsAt.getTime() > now.getTime()) return false;
  if (enrollment.expiresAt !== null && enrollment.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** Детализированная причина отказа по enrollment (для точного кода/диагностики). */
function evaluateEnrollment(
  enrollment: EnrollmentLike | null | undefined,
  now: Date,
): AccessResult {
  if (!enrollment) return deny("NO_ENROLLMENT");
  if (enrollment.revokedAt !== null) return deny("ENROLLMENT_REVOKED");
  if (enrollment.startsAt.getTime() > now.getTime()) {
    return deny("ENROLLMENT_NOT_STARTED");
  }
  if (enrollment.expiresAt !== null && enrollment.expiresAt.getTime() <= now.getTime()) {
    return deny("ENROLLMENT_EXPIRED");
  }
  return ALLOW;
}

/** Доступ к курсу как к сущности: OWNER видит всё (включая DRAFT/ARCHIVED),
 *  остальные — только PUBLISHED. Сам факт записи здесь не проверяется. */
export function evaluateCourseAccess(input: {
  course: CourseLike | null | undefined;
  role: UserRole | null | undefined;
}): AccessResult {
  const { course, role } = input;
  if (!course) return deny("COURSE_NOT_FOUND");
  if (role === "OWNER") return ALLOW;
  if (course.status !== "PUBLISHED") return deny("COURSE_NOT_PUBLISHED");
  return ALLOW;
}

/**
 * Доступ к КОНТЕНТУ урока (видео, субтитры, транскрипт, материалы).
 * Порядок проверок важен — от «не найдено» к «нет прав»:
 *  1. OWNER — полный доступ, минуя публикацию и enrollment.
 *  2. Курс должен быть опубликован.
 *  3. Урок должен быть опубликован.
 *  4. Бесплатное превью — доступно без enrollment.
 *  5. Иначе — нужен активный enrollment (не отозван/не истёк/начался).
 */
export function evaluateLessonAccess(input: {
  course: CourseLike | null | undefined;
  lesson: LessonLike | null | undefined;
  enrollment: EnrollmentLike | null | undefined;
  role: UserRole | null | undefined;
  now: Date;
}): AccessResult {
  const { course, lesson, enrollment, role, now } = input;

  if (role === "OWNER") return ALLOW;

  if (!course) return deny("COURSE_NOT_FOUND");
  if (course.status !== "PUBLISHED") return deny("COURSE_NOT_PUBLISHED");

  if (!lesson) return deny("LESSON_NOT_FOUND");
  if (lesson.status !== "PUBLISHED") return deny("LESSON_NOT_PUBLISHED");

  if (lesson.isFreePreview) return ALLOW;

  return evaluateEnrollment(enrollment, now);
}

/**
 * Последовательная разблокировка по `requiresQuizPass` (для навигации в кабинете,
 * S4.2). Урок открыт, если КАЖДЫЙ предшествующий ему урок, помеченный
 * `requiresQuizPass`, имеет сданный тест. Сам гейт enrollment проверяется отдельно
 * через `evaluateLessonAccess` — эта функция отвечает только за порядок прохождения.
 *
 * @param orderedLessons — уроки курса в порядке прохождения (module.sortOrder, затем lesson.sortOrder)
 * @param isQuizPassed   — предикат «тест урока сдан»
 * @param targetLessonId — урок, к которому проверяется доступ
 */
export function evaluateLessonUnlock(input: {
  orderedLessons: { id: string; requiresQuizPass: boolean }[];
  isQuizPassed: (lessonId: string) => boolean;
  targetLessonId: string;
}): AccessResult {
  const { orderedLessons, isQuizPassed, targetLessonId } = input;
  for (const lesson of orderedLessons) {
    if (lesson.id === targetLessonId) return ALLOW;
    if (lesson.requiresQuizPass && !isQuizPassed(lesson.id)) {
      return deny("PREREQUISITE_NOT_MET");
    }
  }
  // targetLessonId не найден среди уроков курса — считаем «не найдено».
  return deny("LESSON_NOT_FOUND");
}

// ─────────────────────────── БД-обёртки ───────────────────────────

/** Запись пользователя на курс (или null). Тонкая обёртка над unique-индексом. */
export async function getEnrollment(
  userId: string,
  courseId: string,
): Promise<EnrollmentLike | null> {
  return db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { startsAt: true, expiresAt: true, revokedAt: true },
  });
}

/** Доступ к курсу по slug. Грузит статус курса + роль пользователя + enrollment. */
export async function canAccessCourse(
  userId: string,
  courseSlug: string,
  now: Date = new Date(),
): Promise<AccessResult> {
  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.course.findUnique({
      where: { slug: courseSlug },
      select: { id: true, status: true },
    }),
  ]);

  const base = evaluateCourseAccess({ course, role: user?.role });
  if (!base.ok) return base;
  if (user?.role === "OWNER") return ALLOW;

  // Курс опубликован — но для контентного доступа всё равно нужна запись.
  const enrollment = course ? await getEnrollment(userId, course.id) : null;
  return evaluateEnrollment(enrollment, now);
}

/**
 * ГЛАВНАЯ функция для видео-API (S2.2): можно ли пользователю смотреть урок.
 * Один запрос разворачивает урок → модуль → курс; enrollment грузится отдельно
 * только если урок не бесплатный и пользователь не OWNER.
 */
export async function canAccessLesson(
  userId: string,
  lessonId: string,
  now: Date = new Date(),
): Promise<AccessResult> {
  const [user, lesson] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        status: true,
        isFreePreview: true,
        module: {
          select: { course: { select: { id: true, status: true } } },
        },
      },
    }),
  ]);

  if (!lesson) return deny("LESSON_NOT_FOUND");

  const course = lesson.module.course;
  const role = user?.role ?? null;

  // OWNER / бесплатное превью / неопубликованное — решает чистая логика без enrollment.
  if (role === "OWNER" || lesson.isFreePreview || course.status !== "PUBLISHED" || lesson.status !== "PUBLISHED") {
    return evaluateLessonAccess({ course, lesson, enrollment: null, role, now });
  }

  const enrollment = await getEnrollment(userId, course.id);
  return evaluateLessonAccess({ course, lesson, enrollment, role, now });
}

/** Бросается при отказе в доступе. `status` — готовый HTTP-код для video-API. */
export class AccessDeniedError extends Error {
  readonly reason: AccessDenyReason;
  readonly status: 403 | 404;
  constructor(reason: AccessDenyReason) {
    super(`Access denied: ${reason}`);
    this.name = "AccessDeniedError";
    this.reason = reason;
    this.status = httpStatusForDeny(reason);
  }
}

/** Как `canAccessLesson`, но бросает `AccessDeniedError` вместо результата —
 *  удобно в API-роутах: `await assertLessonAccess(...)` либо 403/404. */
export async function assertLessonAccess(
  userId: string,
  lessonId: string,
  now: Date = new Date(),
): Promise<void> {
  const result = await canAccessLesson(userId, lessonId, now);
  if (!result.ok) throw new AccessDeniedError(result.reason);
}
