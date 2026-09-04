import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid, CheckCircle2, GraduationCap, Info, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { env } from "@/env";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { canAccessLesson, evaluateLessonUnlock } from "@/lib/access";
import { LessonTabs } from "@/components/learn/lesson-tabs";
import { type SidebarModule } from "@/components/learn/lesson-sidebar";
import { CourseOutline } from "@/components/learn/course-outline";
import { parseDeck } from "@/lib/slides";
import {
  parseFlashcards,
  parseObjections,
  parseChecklist,
  parseScriptBuilder,
  parseDialogueAudit,
  parseHotspot,
  parseBranching,
  parseMetaphors,
  parseEisenhower,
  parseRule6040,
  parseSmartGoal,
  parseTimeAudit,
  parseClientTypes,
  parseStageLadder,
  parseObjectionScale,
  parseNeedsCart,
} from "@/lib/interactive";
import { loadScenario } from "@/lib/ai/simulate";
import { listLessonNotes } from "@/lib/learn/notes";

export const metadata: Metadata = {
  title: "Урок",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
  searchParams?: Promise<{ t?: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  const sp = searchParams ? await searchParams : {};
  const tParam = Number(sp.t);
  const session = await requireUser();
  const userId = session.user.id;

  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) notFound();

  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      title: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          title: true,
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
              videoStatus: true,
              audioKey: true,
              podcastKey: true,
              slidesPdfKey: true,
              requiresQuizPass: true,
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  // Прогресс пользователя по урокам этого курса.
  const progress = await db.lessonProgress.findMany({
    where: { userId, completedAt: { not: null }, lesson: { module: { course: { slug: courseSlug } } } },
    select: { lessonId: true },
  });
  const completedSet = new Set(progress.map((p) => p.lessonId));

  // Последовательное прохождение: урок с заданием открывает следующий только
  // после сдачи теста (lib/access.evaluateLessonUnlock). Владелец видит всё.
  const isOwner = session.user.role === "OWNER";
  const passedLessonQuizzes = await db.quizAttempt.findMany({
    where: {
      userId,
      status: "PASSED",
      quiz: { kind: "LESSON_QUIZ", lesson: { module: { course: { slug: courseSlug } } } },
    },
    select: { quiz: { select: { lessonId: true } } },
  });
  const passedLessonIds = new Set(
    passedLessonQuizzes.map((a) => a.quiz.lessonId).filter((id): id is string => !!id),
  );

  const lessonPos = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { lastPositionSec: true, completedAt: true },
  });

  // Конспект (SUMMARY), презентация (SLIDES), карточки (FLASHCARDS),
  // тренажёр возражений (OBJECTIONS) и транскрипт урока.
  const [summaryArtifact, slidesArtifact, flashcardsArtifact, objectionsArtifact, transcript] =
    await Promise.all([
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "SUMMARY" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "SLIDES" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "FLASHCARDS" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "OBJECTIONS" } },
        select: { content: true, validation: true },
      }),
      db.transcript.findUnique({
        where: { lessonId },
        select: { cleanText: true, status: true },
      }),
    ]);

  // Новые интерактивы (чек-лист, скрипт, «найди ошибку», hotspot) + сценарий симулятора.
  const [checklistArtifact, scriptArtifact, auditArtifact, hotspotArtifact, branchingArtifact, simulation] =
    await Promise.all([
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "CHECKLIST" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "SCRIPT_BUILDER" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "DIALOGUE_AUDIT" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "HOTSPOT" } },
        select: { content: true, validation: true },
      }),
      db.aiArtifact.findUnique({
        where: { lessonId_type: { lessonId, type: "BRANCHING" } },
        select: { content: true, validation: true },
      }),
      loadScenario(lessonId),
    ]);

  const [metaphorArtifact, eisenhowerArtifact, rule6040Artifact, smartArtifact, timeAuditArtifact, clientTypesArtifact] = await Promise.all([
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "TASK_METAPHOR" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "EISENHOWER" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "RULE_6040" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "SMART_GOAL" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "TIME_AUDIT" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "CLIENT_TYPES" } },
      select: { content: true, validation: true },
    }),
  ]);

  const [ladderArtifact, scaleArtifact, cartArtifact] = await Promise.all([
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "STAGE_LADDER" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "OBJECTION_SCALE" } },
      select: { content: true, validation: true },
    }),
    db.aiArtifact.findUnique({
      where: { lessonId_type: { lessonId, type: "NEEDS_CART" } },
      select: { content: true, validation: true },
    }),
  ]);

  const summary = summaryArtifact?.validation === "VALIDATED" ? summaryArtifact.content : null;
  const slides =
    slidesArtifact?.validation === "VALIDATED" ? parseDeck(slidesArtifact.content) : null;
  const flashcards =
    flashcardsArtifact?.validation === "VALIDATED" ? parseFlashcards(flashcardsArtifact.content) : null;
  const objections =
    objectionsArtifact?.validation === "VALIDATED" ? parseObjections(objectionsArtifact.content) : null;
  const checklist =
    checklistArtifact?.validation === "VALIDATED" ? parseChecklist(checklistArtifact.content) : null;
  const script =
    scriptArtifact?.validation === "VALIDATED" ? parseScriptBuilder(scriptArtifact.content) : null;
  const audit =
    auditArtifact?.validation === "VALIDATED" ? parseDialogueAudit(auditArtifact.content) : null;
  const hotspot =
    hotspotArtifact?.validation === "VALIDATED" ? parseHotspot(hotspotArtifact.content) : null;
  const branching =
    branchingArtifact?.validation === "VALIDATED" ? parseBranching(branchingArtifact.content) : null;
  const metaphor =
    metaphorArtifact?.validation === "VALIDATED" ? parseMetaphors(metaphorArtifact.content) : null;
  const eisenhower =
    eisenhowerArtifact?.validation === "VALIDATED" ? parseEisenhower(eisenhowerArtifact.content) : null;
  const rule6040 =
    rule6040Artifact?.validation === "VALIDATED" ? parseRule6040(rule6040Artifact.content) : null;
  const smart =
    smartArtifact?.validation === "VALIDATED" ? parseSmartGoal(smartArtifact.content) : null;
  const timeaudit =
    timeAuditArtifact?.validation === "VALIDATED" ? parseTimeAudit(timeAuditArtifact.content) : null;
  const clientTypes =
    clientTypesArtifact?.validation === "VALIDATED" ? parseClientTypes(clientTypesArtifact.content) : null;
  const ladder =
    ladderArtifact?.validation === "VALIDATED" ? parseStageLadder(ladderArtifact.content) : null;
  const scale =
    scaleArtifact?.validation === "VALIDATED" ? parseObjectionScale(scaleArtifact.content) : null;
  const cart =
    cartArtifact?.validation === "VALIDATED" ? parseNeedsCart(cartArtifact.content) : null;
  const transcriptText =
    transcript && transcript.status === "CLEANED" ? transcript.cleanText : null;

  // Задание к уроку (LESSON_QUIZ), если есть.
  const lessonQuiz = await db.quiz.findFirst({
    where: { lessonId, kind: "LESSON_QUIZ", status: "PUBLISHED" },
    select: { id: true, title: true },
  });

  // Итоговый экзамен курса — показываем в оглавлении, чтобы его было видно
  // с любого урока, а не только из кабинета.
  const finalExam = await db.quiz.findFirst({
    where: { courseId: course.id, kind: "FINAL_EXAM", status: "PUBLISHED" },
    select: { id: true, title: true, passScore: true },
  });
  const examPassed = finalExam
    ? (await db.quizAttempt.count({
        where: {
          quizId: finalExam.id,
          userId,
          status: "PASSED",
        },
      })) > 0
    : false;

  // Доступные дорожки субтитров + язык по умолчанию из профиля + заметки ученика.
  const [subtitleTracks, viewer, notes] = await Promise.all([
    db.subtitleTrack.findMany({
      where: { lessonId, validation: "VALIDATED" },
      select: { lang: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { subtitleLang: true } }),
    listLessonNotes(userId, lessonId),
  ]);
  const LANG_LABELS: Record<string, string> = { RU: "Русский", KK: "Қазақша", EN: "English", UZ: "Oʻzbekcha" };
  const langOrder = ["RU", "KK", "EN", "UZ"];
  const subtitles = subtitleTracks
    .map((t) => ({ lang: t.lang as "RU" | "KK" | "EN" | "UZ", label: LANG_LABELS[t.lang] ?? t.lang }))
    .sort((a, b) => langOrder.indexOf(a.lang) - langOrder.indexOf(b.lang));

  // Порядок прохождения курса: только опубликованные уроки, модуль за модулем.
  const orderedLessons = course.modules
    .flatMap((m) => m.lessons)
    .filter((l) => l.status === "PUBLISHED")
    .map((l) => ({ id: l.id, requiresQuizPass: l.requiresQuizPass }));
  const isUnlocked = (id: string) =>
    isOwner ||
    evaluateLessonUnlock({
      orderedLessons,
      isQuizPassed: (lid) => passedLessonIds.has(lid),
      targetLessonId: id,
    }).ok;

  // Оглавление + плоский порядок доступных уроков для prev/next.
  const flat: { id: string; title: string }[] = [];
  const modules: SidebarModule[] = course.modules.map((m) => ({
    title: m.title,
    lessons: m.lessons.map((l) => {
      const published = l.status === "PUBLISHED";
      const available = published && isUnlocked(l.id);
      if (published) flat.push({ id: l.id, title: l.title });
      return {
        id: l.id,
        title: l.title,
        available,
        completed: completedSet.has(l.id),
        locked: published && !available,
      };
    }),
  }));

  const current = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!current) notFound();

  const idx = flat.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  // Текущий урок закрыт: не отдаём 404 (урок существует и оплачен), а объясняем,
  // какое задание нужно сдать, и ведём прямо к нему.
  if (!isUnlocked(lessonId)) {
    const blockerIdx = orderedLessons.findIndex(
      (l) => l.requiresQuizPass && !passedLessonIds.has(l.id),
    );
    const blocker = blockerIdx >= 0 ? orderedLessons[blockerIdx]! : null;
    const blockerTitle = blocker ? flat.find((l) => l.id === blocker.id)?.title : null;
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <Lock className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Урок пока закрыт</h1>
        <p className="mt-2 text-foreground/70">
          Уроки курса проходятся по порядку: следующий открывается после того, как сдано
          задание предыдущего урока.
          {blockerTitle ? <> Сейчас нужно сдать задание урока «{blockerTitle}».</> : null}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {blocker ? (
            <Link
              href={`/app/learn/${courseSlug}/${blocker.id}`}
              className={buttonVariants({ variant: "accent", size: "sm" })}
            >
              Перейти к уроку
              <ChevronRight className="size-4" />
            </Link>
          ) : null}
          <Link href="/app" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <LayoutGrid className="size-4" />
            Моё обучение
          </Link>
        </div>
      </main>
    );
  }

  // Задание текущего урока открывает следующий: пока не сдано — «Следующий урок»
  // недоступен, вместо кнопки показываем понятное объяснение.
  const nextLocked = !!next && !isUnlocked(next.id);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[260px_1fr]">
      {/* Сайдбар-оглавление (на мобильном — свёрнутая плашка над уроком) */}
      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 text-sm">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-foreground/60 transition-colors hover:text-foreground"
          >
            <LayoutGrid className="size-4" />
            Моё обучение
          </Link>
          <Link
            href={`/courses/${courseSlug}`}
            className="inline-flex items-center gap-1.5 text-foreground/60 transition-colors hover:text-foreground"
          >
            <Info className="size-4" />
            О курсе
          </Link>
        </div>
        <CourseOutline
          courseSlug={courseSlug}
          courseTitle={course.title}
          modules={modules}
          currentLessonId={lessonId}
          position={{ index: idx + 1, total: flat.length }}
          exam={finalExam ? { ...finalExam, passed: examPassed } : null}
        />
      </aside>

      {/* Урок */}
      <main className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">{current.title}</h1>
          {lessonPos?.completedAt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Пройден
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <LessonTabs
            lessonId={lessonId}
            videoReady={current.videoStatus === "READY"}
            hasAudio={!!current.audioKey}
            hasPodcast={!!current.podcastKey}
            watermark={session.user.email ?? userId}
            startPositionSec={
              Number.isFinite(tParam) && tParam > 0 ? tParam : lessonPos?.lastPositionSec ?? 0
            }
            summary={summary}
            transcript={transcriptText}
            notes={notes}
            slides={slides}
            hasSlidesPdf={!!current.slidesPdfKey}
            flashcards={flashcards}
            objections={objections}
            branching={branching}
            checklist={checklist}
            script={script}
            audit={audit}
            hotspot={hotspot}
            metaphor={metaphor}
            eisenhower={eisenhower}
            rule6040={rule6040}
            smart={smart}
            timeaudit={timeaudit}
            clientTypes={clientTypes}
            ladder={ladder}
            scale={scale}
            cart={cart}
            simulation={simulation}
            quiz={lessonQuiz}
            voiceEnabled={env.VOICE_ENABLED}
            subtitles={subtitles}
            defaultSubtitleLang={viewer?.subtitleLang ?? null}
          />
        </div>

        {/* Подсказка об автозачёте прогресса (пока урок не пройден и есть видео) */}
        {!lessonPos?.completedAt && current.videoStatus === "READY" ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-foreground/55">
            <Info className="size-3.5 shrink-0" />
            Урок отметится пройденным автоматически после просмотра ≥90% видео.
          </p>
        ) : null}

        {/* Задание к уроку */}
        {lessonQuiz ? (
          <Link
            href={`/app/quiz/${lessonQuiz.id}`}
            className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 transition-colors hover:bg-amber-500/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <p className="font-semibold">Проверь себя</p>
                <p className="text-sm text-foreground/60">{lessonQuiz.title}</p>
                {nextLocked ? (
                  <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                    Сдайте задание — оно открывает следующий урок.
                  </p>
                ) : null}
              </div>
            </div>
            <ChevronRight className="size-5 text-amber-700" />
          </Link>
        ) : null}

        {/* Навигация prev/next */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {prev ? (
            <Link
              href={`/app/learn/${courseSlug}/${prev.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Link>
          ) : (
            <span />
          )}
          {next && !nextLocked ? (
            <Link
              href={`/app/learn/${courseSlug}/${next.id}`}
              className={buttonVariants({ variant: "accent", size: "sm" })}
            >
              Следующий урок
              <ChevronRight className="size-4" />
            </Link>
          ) : next ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-1.5 text-sm text-foreground/45">
              <Lock className="size-4" />
              Следующий урок откроется после сдачи задания
            </span>
          ) : (
            <span />
          )}
        </div>
      </main>
    </div>
  );
}
