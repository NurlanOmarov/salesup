import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { canAccessCourse } from "@/lib/access";
import { ExamRunner } from "./exam-runner";
import type { RunnerQuestion } from "@/components/quiz/types";

export const metadata: Metadata = {
  title: "Тест",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const session = await requireUser();
  const userId = session.user.id;

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      description: true,
      passScore: true,
      maxAttempts: true,
      status: true,
      course: { select: { slug: true, title: true } },
      questions: {
        where: { validation: "VALIDATED" },
        orderBy: { sortOrder: "asc" },
        // ВАЖНО: isCorrect НЕ выбираем — правильные ответы не уходят на клиент.
        select: {
          id: true,
          type: true,
          text: true,
          options: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, text: true },
          },
        },
      },
    },
  });

  if (!quiz || quiz.status !== "PUBLISHED" || !quiz.course) notFound();

  const access = await canAccessCourse(userId, quiz.course.slug);
  if (!access.ok) notFound();

  // Прошлые попытки — лучший результат + число использованных.
  const attempts = await db.quizAttempt.findMany({
    where: { quizId, userId, status: { in: ["PASSED", "FAILED"] } },
    select: { scorePct: true, status: true },
  });
  const bestScore = attempts.reduce((m, a) => Math.max(m, a.scorePct ?? 0), 0);
  const alreadyPassed = attempts.some((a) => a.status === "PASSED");
  const attemptsLeft =
    quiz.maxAttempts != null ? Math.max(0, quiz.maxAttempts - attempts.length) : null;

  const questions: RunnerQuestion[] = quiz.questions.map((q) => {
    // Для ORDERING перемешиваем варианты — правильный порядок не должен быть виден.
    const options =
      q.type === "ORDERING" ? [...q.options].sort(() => Math.random() - 0.5) : q.options;
    return {
      id: q.id,
      type: q.type as RunnerQuestion["type"],
      text: q.text,
      options,
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/courses/${quiz.course.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {quiz.course.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{quiz.title}</h1>
      {quiz.description ? (
        <p className="mt-1 text-foreground/60">{quiz.description}</p>
      ) : null}
      <p className="mt-2 text-sm text-foreground/50">
        Проходной балл: {quiz.passScore}%
        {attempts.length > 0 ? ` · лучший результат: ${bestScore}%` : ""}
        {attemptsLeft != null ? ` · осталось попыток: ${attemptsLeft}` : ""}
      </p>

      <div className="mt-6">
        <ExamRunner
          quizId={quiz.id}
          questions={questions}
          alreadyPassed={alreadyPassed}
          attemptsLeft={attemptsLeft}
        />
      </div>
    </main>
  );
}
