import { db } from "@/lib/db";
import { env } from "@/env";
import { hasDemoLimit } from "@/lib/access";
import { enqueue } from "@/lib/jobs/enqueue";
import { log } from "@/lib/log";
import { checkEligibility, type IneligibleReason } from "./eligibility.js";
import { randomBytes } from "node:crypto";
import { storage } from "@/lib/storage";
import {
  certificateReadyTelegramText,
  certificateIssuedTelegramText,
  certificateTelegramButtons,
  type CertificateLearner,
} from "./notify.js";
import { renderCertificatePdf } from "./pdf.js";
import { formatCertificateNumber, passedVerb } from "./holder.js";

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
): Promise<{ ready: boolean; certificateId?: string; reason?: IneligibleReason | "DEMO" }> {
  // Уже готов/выдан?
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (existing) return { ready: true, certificateId: existing.id };

  // Демо-доступ (Enrollment/OrgLicense.demoPercent) сертификата не даёт: часть
  // курса не пройдена по определению, а экзамен при демо закрыт. Проверка явная,
  // чтобы готовность не появилась от старых попыток, сданных до включения демо.
  if (await hasDemoLimit(userId, courseId)) return { ready: false, reason: "DEMO" };

  const course = await db.course.findUnique({
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
  if (!eligibility.eligible) return { ready: false, reason: eligibility.reason };

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

  // Владельцу — сразу в Telegram: сертификат выдаёт он, и узнавать о готовом
  // ученике только из письма с ФИО (которое может и не дойти) нельзя.
  // Сбой уведомления не отменяет готовность сертификата.
  try {
    await enqueue("telegram.send", {
      text: certificateReadyTelegramText({
        courseTitle: course.title,
        scorePct: bestAttempt?.scorePct ?? null,
        learner: await certificateLearner(userId),
      }),
      buttons: certificateTelegramButtons(env.NEXT_PUBLIC_SITE_URL),
      kind: "certificate-ready",
    });
  } catch (e) {
    log.error({ err: e }, "certificate: уведомление владельцу не поставлено в очередь");
  }

  return { ready: true, certificateId: cert.id };
}

/** Кто ученик — для уведомлений владельцу (розница — e-mail, B2B — логин и клиент). */
export async function certificateLearner(userId: string): Promise<CertificateLearner> {
  const [user, membership] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true, login: true } }),
    db.orgMembership.findFirst({ where: { userId }, select: { org: { select: { name: true } } } }),
  ]);
  return {
    email: user?.email ?? null,
    login: user?.login ?? null,
    orgName: membership?.org.name ?? null,
  };
}

// ─────────────────────────── Автоматическая выдача (D-019) ───────────────────────────

/** Ключ PDF в lib/storage — относительный, как всё медиа (CLAUDE.md, правило 3). */
export function certificatePdfKey(certificateId: string): string {
  return `certificates/${certificateId}.pdf`;
}

export class CertificateIssueError extends Error {}

/**
 * Выпуск сертификата по ФИО, которое ввёл сам ученик (шаг 2 страницы сертификатов).
 * Условия: запись «Готов к получению» принадлежит ученику, отзыв о курсе оставлен
 * (шаг 1), согласие на обработку ПДн дано. Номер — из сквозного счётчика
 * (certificate_number_seq), PDF — в lib/storage; затем письмо с PDF уходит
 * ответственному представителю организации или самому ученику (задача
 * `certificate.email`), владельцу — уведомление в Telegram.
 *
 * Идемпотентно: уже выданный сертификат повторно не выпускается.
 */
export async function issueCertificate(input: {
  userId: string;
  certificateId: string;
  holderName: string;
  consentVersion: string;
}): Promise<{ certificateId: string; number: string }> {
  const cert = await db.certificate.findUnique({
    where: { id: input.certificateId },
    select: {
      id: true,
      userId: true,
      courseId: true,
      status: true,
      number: true,
      revokedAt: true,
      course: { select: { title: true, certificateCourseTitle: true, certificateLead: true } },
    },
  });
  if (!cert || cert.userId !== input.userId || cert.revokedAt) {
    throw new CertificateIssueError("Сертификат не найден");
  }
  if (cert.status === "ISSUED" && cert.number) return { certificateId: cert.id, number: cert.number };

  const reviewed = await db.review.findUnique({
    where: { courseId_userId: { courseId: cert.courseId, userId: input.userId } },
    select: { id: true },
  });
  if (!reviewed) throw new CertificateIssueError("Сначала оставьте отзыв о курсе");

  const learner = await certificateLearner(input.userId);
  const issuedAt = new Date();
  const seqRows = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('certificate_number_seq')`;
  const number = formatCertificateNumber(Number(seqRows[0]!.nextval), issuedAt);
  const verifyHash = randomBytes(16).toString("hex");
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const pdf = await renderCertificatePdf({
    holderName: input.holderName,
    orgName: learner.orgName,
    verb: passedVerb(input.holderName),
    lead: cert.course.certificateLead ?? "бизнес-курс онлайн",
    courseTitle: cert.course.certificateCourseTitle ?? cert.course.title,
    number,
    verifyUrl: `${base}/verify/${verifyHash}`,
  });
  const pdfKey = certificatePdfKey(cert.id);
  await storage.put(pdfKey, Buffer.from(pdf));

  await db.certificate.update({
    where: { id: cert.id },
    data: {
      holderName: input.holderName,
      number,
      verifyHash,
      pdfKey,
      status: "ISSUED",
      issuedAt,
      consentAt: issuedAt,
      consentVersion: input.consentVersion,
    },
  });

  // Письмо и уведомление — через очередь: сбой SMTP не должен отменять выдачу,
  // а Job-runner повторит отправку сам.
  try {
    await enqueue("certificate.email", { certificateId: cert.id });
    await enqueue("telegram.send", {
      text: certificateIssuedTelegramText({ courseTitle: cert.course.title, number, learner }),
      buttons: certificateTelegramButtons(env.NEXT_PUBLIC_SITE_URL),
      kind: "certificate-issued",
    });
  } catch (e) {
    log.error({ err: e }, "certificate: письмо/уведомление не поставлены в очередь");
  }

  return { certificateId: cert.id, number };
}
