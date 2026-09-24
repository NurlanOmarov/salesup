import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Dumbbell, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { canAccessCourse, canAccessLesson, hasDemoLimit } from "@/lib/access";
import { ExamRunner } from "./exam-runner";
import { coursePracticeGate } from "@/lib/learn/practice-server";
import { PRACTICE_LABELS } from "@/lib/learn/practice";
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
      course: { select: { id: true, slug: true, title: true, completionMessage: true } },
      lesson: { select: { id: true, title: true, requiresQuizPass: true, module: { select: { course: { select: { slug: true, title: true } } } } } },
      questions: {
        where: { validation: "VALIDATED" },
        orderBy: { sortOrder: "asc" },
        // ВАЖНО: isCorrect НЕ выбираем — правильные ответы не уходят на клиент.
        // pairKey берём только для формирования перемешанных вариантов (choices),
        // привязку left→right клиенту не раскрываем.
        select: {
          id: true,
          type: true,
          text: true,
          options: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, text: true, pairKey: true },
          },
        },
      },
    },
  });

  if (!quiz || quiz.status !== "PUBLISHED") notFound();
  const courseInfo = quiz.course ?? quiz.lesson?.module.course;
  if (!courseInfo) notFound();

  // Доступ к тесту — по доступу к его уроку, а не к курсу: при демо-доступе
  // (Enrollment.demoPercent) тест закрытого урока иначе открывался бы прямой
  // ссылкой. Итоговый экзамен при демо не сдаётся вовсе — он ведёт к сертификату.
  const access = quiz.lesson
    ? await canAccessLesson(userId, quiz.lesson.id)
    : await canAccessCourse(userId, courseInfo.slug);
  if (!access.ok) notFound();
  if (!quiz.lesson) {
    const courseRow = await db.course.findUnique({
      where: { slug: courseInfo.slug },
      select: { id: true },
    });
    if (courseRow && (await hasDemoLimit(userId, courseRow.id))) notFound();
  }

  // Допуск практикой: итоговый экзамен — после тренировки в каждом уроке с
  // тренажёрами. Иначе курс проходили цепочкой «видео → тест», не открывая практику.
  // Кто уже сдал экзамен, не блокируем; владелец видит экзамен всегда.
  if (!quiz.lesson && quiz.course && session.user.role !== "OWNER") {
    const passedExam = await db.quizAttempt.count({ where: { quizId, userId, status: "PASSED" } });
    if (passedExam === 0) {
      const gate = await coursePracticeGate(userId, quiz.course.id);
      if (gate.missing.length > 0) {
        const doneCount = gate.total - gate.missing.length;
        return (
          <main className="mx-auto max-w-2xl px-4 py-8">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Моё обучение
            </Link>
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 sm:p-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
                <Dumbbell className="size-6" />
              </div>
              <h1 className="mt-3 text-xl font-bold">{quiz.title}: сначала практика</h1>
              <p className="mt-2 text-foreground/70">
                Итоговый экзамен открывается, когда в каждом уроке пройдена тренировка. Тест
                проверяет знания, а тренажёр — умение применить их в разговоре с клиентом.
                Каждая тренировка занимает пару минут.
              </p>
              <p className="mt-3 text-sm font-medium text-foreground/60">
                Тренировки: {doneCount} из {gate.total}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.round((doneCount / gate.total) * 100)}%` }}
                />
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {gate.missing.map((l) => (
                <li key={l.lessonId}>
                  <Link
                    href={`/app/learn/${quiz.course!.slug}/${l.lessonId}?tab=practice`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 p-4 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{l.title}</span>
                      <span className="block text-sm text-foreground/55">
                        Тренажёр «{PRACTICE_LABELS[l.mainKind]}»
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-amber-700" />
                  </Link>
                </li>
              ))}
            </ul>
          </main>
        );
      }
    }
  }

  // «Назад» — в кабинет (для итогового экзамена) или к уроку (для задания урока),
  // НЕ на публичную страницу курса.
  const backHref = quiz.lesson
    ? `/app/learn/${courseInfo.slug}/${quiz.lesson.id}`
    : "/app";
  const backLabel = quiz.lesson ? quiz.lesson.title : "Моё обучение";

  // «Куда дальше» на экране результата: для задания урока — следующий доступный
  // урок (или кабинет, если этот был последним); для итогового экзамена — кабинет.
  let continueHref = "/app";
  let continueLabel = "Моё обучение";
  if (quiz.lesson) {
    const courseLessons = await db.course.findUnique({
      where: { slug: courseInfo.slug },
      select: {
        id: true,
        quizzes: {
          where: { kind: "FINAL_EXAM", status: "PUBLISHED" },
          select: { id: true },
          take: 1,
        },
        modules: {
          orderBy: { sortOrder: "asc" },
          select: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, status: true },
            },
          },
        },
      },
    });
    const flat = (courseLessons?.modules ?? [])
      .flatMap((m) => m.lessons)
      .filter((l) => l.status === "PUBLISHED");
    const curIdx = flat.findIndex((l) => l.id === quiz.lesson!.id);
    const nextLesson = curIdx >= 0 ? flat[curIdx + 1] : null;
    const examId = courseLessons?.quizzes[0]?.id;
    if (nextLesson) {
      continueHref = `/app/learn/${courseInfo.slug}/${nextLesson.id}`;
      continueLabel = "Следующий урок";
    } else if (examId && courseLessons && !(await hasDemoLimit(userId, courseLessons.id))) {
      // Последний урок курса: дальше — итоговый экзамен, путь к сертификату.
      continueHref = `/app/quiz/${examId}`;
      continueLabel = "Итоговый экзамен";
    }
  }

  // Прошлые попытки — лучший результат + число использованных.
  const attempts = await db.quizAttempt.findMany({
    where: { quizId, userId, status: { in: ["PASSED", "FAILED"] } },
    select: { scorePct: true, status: true },
  });
  const bestScore = attempts.reduce((m, a) => Math.max(m, a.scorePct ?? 0), 0);
  const alreadyPassed = attempts.some((a) => a.status === "PASSED");
  // Задание урока с requiresQuizPass — пропуск к следующему уроку. Пока оно не сдано,
  // ссылка «Следующий урок» после провала вела бы на экран «Урок пока закрыт».
  const gatesNext = Boolean(quiz.lesson?.requiresQuizPass) && !alreadyPassed && continueHref !== "/app";
  const attemptsLeft =
    quiz.maxAttempts != null ? Math.max(0, quiz.maxAttempts - attempts.length) : null;

  // Типы, где ПОРЯДОК вариантов раскрывает ответ → перемешиваем перед отправкой.
  // (В seed эталон часто стоит первым; без shuffle позиция = подсказка.)
  // FILL_BLANK НЕ трогаем — там порядок = позиции пропусков; MATCHING/CATEGORIZATION
  // не зависят от порядка левых элементов (связь скрыта в pairKey, который не уходит).
  const SHUFFLE_OPTIONS = new Set([
    "SINGLE_CHOICE",
    "MULTI_CHOICE",
    "TRUE_FALSE",
    "SCENARIO",
    "ORDERING",
  ]);

  const questions: RunnerQuestion[] = quiz.questions.map((q) => {
    const ordered = SHUFFLE_OPTIONS.has(q.type)
      ? [...q.options].sort(() => Math.random() - 0.5)
      : q.options;
    // FILL_BLANK: option.text — это ЭТАЛОННЫЙ ответ; на клиент его не отдаём,
    // иначе ответы видны (placeholder/DOM). Шлём только id (= число полей).
    const options = ordered.map((o) => ({
      id: o.id,
      text: q.type === "FILL_BLANK" ? "" : o.text,
    }));

    // MATCHING — перемешанные правые элементы; CATEGORIZATION — уникальные категории.
    let choices: string[] | undefined;
    if (q.type === "MATCHING") {
      choices = q.options
        .map((o) => o.pairKey ?? "")
        .filter(Boolean)
        .sort(() => Math.random() - 0.5);
    } else if (q.type === "CATEGORIZATION") {
      choices = [...new Set(q.options.map((o) => o.pairKey ?? "").filter(Boolean))];
    }

    return { id: q.id, type: q.type as RunnerQuestion["type"], text: q.text, options, choices };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
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
          continueHref={continueHref}
          continueLabel={continueLabel}
          gatesNext={gatesNext}
          backHref={backHref}
          isExam={!quiz.lesson}
          completionMessage={quiz.course?.completionMessage ?? null}
        />
      </div>
    </main>
  );
}
