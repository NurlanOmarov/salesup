"use server";

import { z } from "zod";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { canAccessCourse } from "@/lib/access";
import { scoreAttempt, type QuestionLike, type GradableType } from "@/lib/quiz/scoring";
import { markCertificateReadyIfEligible } from "@/lib/certificates/issue";
import { awardXp, awardBadge } from "@/lib/gamification/award";
import { XP_REWARDS } from "@/lib/gamification/levels";

/**
 * Приём и оценка попытки теста (S4.1). Правильные ответы НЕ покидают сервер до сдачи:
 * клиент присылает только выбранные optionId, оценка — здесь через scoreAttempt.
 * Доступ к тесту определяется доступом к курсу (lib/access). Учитывается maxAttempts.
 */
export const submitQuizAttempt = safeAction(
  {
    schema: z.object({
      quizId: z.string().min(1),
      // questionId → массив выбранных optionId
      answers: z.record(z.string(), z.array(z.string())),
    }),
    auth: "user",
  },
  async ({ quizId, answers }, { session }) => {
    const userId = session!.user.id;

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        kind: true,
        courseId: true,
        passScore: true,
        maxAttempts: true,
        status: true,
        // FINAL_EXAM привязан к курсу; LESSON_QUIZ — к уроку (курс через модуль).
        course: { select: { slug: true } },
        lesson: { select: { module: { select: { course: { select: { slug: true } } } } } },
        questions: {
          where: { validation: "VALIDATED" },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            type: true,
            points: true,
            explanation: true,
            options: { select: { id: true, isCorrect: true, text: true, sortOrder: true, pairKey: true } },
          },
        },
      },
    });
    if (!quiz || quiz.status !== "PUBLISHED") throw new Error("Тест недоступен");
    const courseSlug = quiz.course?.slug ?? quiz.lesson?.module.course.slug;
    if (!courseSlug) throw new Error("Тест не привязан к курсу");

    const access = await canAccessCourse(userId, courseSlug);
    if (!access.ok) throw new Error("Нет доступа к курсу");

    // Лимит пересдач
    if (quiz.maxAttempts != null) {
      const used = await db.quizAttempt.count({
        where: { quizId, userId, status: { in: ["PASSED", "FAILED"] } },
      });
      if (used >= quiz.maxAttempts) throw new Error("Исчерпан лимит попыток");
    }

    // Оценка всех поддержанных типов (choice / ordering / fill_blank).
    const gradable: QuestionLike[] = quiz.questions.map((q) => ({
      id: q.id,
      type: q.type as GradableType,
      points: q.points,
      options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect, sortOrder: o.sortOrder, text: o.text, pairKey: o.pairKey })),
    }));
    const result = scoreAttempt(gradable, answers, quiz.passScore);

    // Сохраняем попытку и ответы
    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId,
        status: result.passed ? "PASSED" : "FAILED",
        scorePct: result.scorePct,
        finishedAt: new Date(),
        answers: {
          create: quiz.questions.map((q) => {
            const sel = answers[q.id] ?? [];
            const pq = result.perQuestion.find((p) => p.questionId === q.id);
            return {
              questionId: q.id,
              payload: sel,
              isCorrect: pq?.correct ?? false,
              pointsAwarded: pq?.points ?? 0,
            };
          }),
        },
      },
      select: { id: true },
    });

    // Сдан итоговый экзамен → пробуем выдать сертификат (идемпотентно).
    // Ошибки генерации PDF не должны ронять ответ: тест уже зачтён.
    let certificateReady = false;
    if (result.passed && quiz.kind === "FINAL_EXAM" && quiz.courseId) {
      try {
        const r = await markCertificateReadyIfEligible(userId, quiz.courseId);
        certificateReady = r.ready;
      } catch (e) {
        console.error("Не удалось зафиксировать готовность к сертификату:", e);
      }
    }

    // Геймификация — сдержанно, за реальные достижения. Не критично к ответу.
    if (result.passed) {
      try {
        await awardXp(userId, quiz.kind === "FINAL_EXAM" ? XP_REWARDS.examPassed : XP_REWARDS.quizPassed);
        if (quiz.kind === "FINAL_EXAM" && result.scorePct === 100) await awardBadge(userId, "perfect-exam");
        if (certificateReady) {
          await awardXp(userId, XP_REWARDS.certificate);
          await awardBadge(userId, "course-complete");
        }
      } catch (e) {
        console.error("Награды за тест не начислены:", e);
      }
    }

    // Разбор для показа после сдачи (правильные ответы раскрываются только теперь).
    // ORDERING — id в правильном порядке (sortOrder); FILL_BLANK — эталонные тексты.
    const review = quiz.questions.map((q) => {
      const sorted = [...q.options].sort((a, b) => a.sortOrder - b.sortOrder);
      const correctOptionIds =
        q.type === "ORDERING"
          ? sorted.map((o) => o.id)
          : q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const correctTexts = q.type === "FILL_BLANK" ? sorted.map((o) => o.text) : undefined;
      const correctPairs =
        q.type === "MATCHING" || q.type === "CATEGORIZATION"
          ? sorted.map((o) => ({ left: o.text, right: o.pairKey ?? "" }))
          : undefined;
      return {
        questionId: q.id,
        correct: result.perQuestion.find((p) => p.questionId === q.id)?.correct ?? false,
        explanation: q.explanation,
        correctOptionIds,
        correctTexts,
        correctPairs,
      };
    });

    const xpEarned = result.perQuestion.filter((p) => p.correct).length * 10;

    return {
      attemptId: attempt.id,
      scorePct: result.scorePct,
      passed: result.passed,
      passScore: quiz.passScore,
      certificateReady,
      xpEarned,
      review,
    };
  },
);
