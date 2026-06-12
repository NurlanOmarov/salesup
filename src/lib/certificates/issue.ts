import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/env";
import { storage } from "@/lib/storage";
import { checkEligibility, certificateNumber } from "./eligibility.js";
import { renderCertificatePdf } from "./pdf.js";

/**
 * Выдача именного сертификата при выполнении условий (S5.3): все опубликованные
 * уроки пройдены + итоговый экзамен сдан ≥ minScore. Идемпотентно: повторный вызов
 * возвращает уже существующий сертификат (unique userId+courseId). PDF кладётся в
 * storage, доступен ученику; публичная проверка — по verifyHash.
 *
 * Вызывается после сдачи экзамена. Ошибки генерации PDF не должны ронять основной
 * поток (тест уже сдан) — вызывающий код оборачивает в try/catch.
 */
export async function issueCertificateIfEligible(
  userId: string,
  courseId: string,
): Promise<{ issued: boolean; certificateId?: string }> {
  // Уже выдан?
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (existing) return { issued: true, certificateId: existing.id };

  const [course, user] = await Promise.all([
    db.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
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
    }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);
  if (!course || !user) return { issued: false };

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
  if (!eligibility.eligible) return { issued: false };

  // Номер и хеш
  const issuedAt = new Date();
  const seq = (await db.certificate.count()) + 1;
  const number = certificateNumber(issuedAt.getFullYear(), seq);
  const verifyHash = randomBytes(16).toString("hex");
  const holderName = user.name ?? user.email ?? "Ученик";
  const verifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/verify/${verifyHash}`;

  // PDF → storage
  const pdfKey = `certificates/${verifyHash}.pdf`;
  const pdfBytes = await renderCertificatePdf({
    holderName,
    courseTitle: course.title,
    number,
    hoursLabel: course.hoursLabel,
    scorePct: bestAttempt?.scorePct ?? null,
    issuedAt,
    verifyUrl,
  });
  await storage.put(pdfKey, Buffer.from(pdfBytes));

  const cert = await db.certificate.create({
    data: {
      number,
      userId,
      courseId,
      holderName,
      scorePct: bestAttempt?.scorePct ?? null,
      hoursLabel: course.hoursLabel,
      pdfKey,
      verifyHash,
      issuedAt,
    },
    select: { id: true },
  });

  return { issued: true, certificateId: cert.id };
}
