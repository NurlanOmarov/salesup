import { db } from "@/lib/db";
import { checkEligibility } from "./eligibility.js";

/**
 * Фиксация готовности к сертификату при выполнении условий (S5.3): все опубликованные
 * уроки пройдены + итоговый экзамен сдан ≥ minScore.
 *
 * Минимизация ПДн (правило 9): сертификат НЕ формируется автоматически и ФИО НЕ
 * сохраняется. Создаётся запись со статусом READY («готов к выдаче»); ученику
 * показывается инструкция отправить ФИО на почту, владелец изготавливает документ вне
 * системы и вручную помечает ISSUED (админка). Идемпотентно: повторный вызов
 * возвращает существующую запись (unique userId+courseId).
 *
 * Вызывается после сдачи экзамена; вызывающий код оборачивает в try/catch (тест уже
 * зачтён — сбой фиксации готовности не должен ронять основной поток).
 */
export async function markCertificateReadyIfEligible(
  userId: string,
  courseId: string,
): Promise<{ ready: boolean; certificateId?: string }> {
  // Уже готов/выдан?
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (existing) return { ready: true, certificateId: existing.id };

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      hoursLabel: true,
      certificateEnabled: true,
      certificateMinScore: true,
      modules: {
        select: { lessons: { where: { status: "PUBLISHED" }, select: { id: true } } },
      },
      quizzes: {
        where: { kind: "FINAL_EXAM", status: "PUBLISHED" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!course) return { ready: false };

  const publishedLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const completed = await db.lessonProgress.count({
    where: { userId, completedAt: { not: null }, lessonId: { in: publishedLessonIds } },
  });

  const examId = course.quizzes[0]?.id;
  const bestAttempt = examId
    ? await db.quizAttempt.findFirst({
        where: { quizId: examId, userId, status: "PASSED" },
        orderBy: { scorePct: "desc" },
        select: { scorePct: true },
      })
    : null;

  const eligibility = checkEligibility({
    totalPublishedLessons: publishedLessonIds.length,
    completedLessons: completed,
    examPassed: !!bestAttempt,
    examScorePct: bestAttempt?.scorePct ?? null,
    minScore: course.certificateMinScore,
    certificateEnabled: course.certificateEnabled,
  });
  if (!eligibility.eligible) return { ready: false };

  // Запись готовности — без ФИО/номера/hash/PDF (ПДн не формируем).
  const cert = await db.certificate.create({
    data: {
      userId,
      courseId,
      scorePct: bestAttempt?.scorePct ?? null,
      hoursLabel: course.hoursLabel,
      status: "READY",
    },
    select: { id: true },
  });

  return { ready: true, certificateId: cert.id };
}
