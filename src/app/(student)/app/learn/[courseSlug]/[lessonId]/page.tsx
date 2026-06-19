import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid, CheckCircle2, GraduationCap, Info } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { env } from "@/env";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { canAccessLesson } from "@/lib/access";
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
} from "@/lib/interactive";
import { loadScenario } from "@/lib/ai/simulate";

export const metadata: Metadata = {
  title: "Урок",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  const session = await requireUser();
  const userId = session.user.id;

  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) notFound();

  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    select: {
      title: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          title: true,
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, status: true, videoStatus: true, audioKey: true, podcastKey: true },
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
  const transcriptText =
    transcript && transcript.status === "CLEANED" ? transcript.cleanText : null;

  // Задание к уроку (LESSON_QUIZ), если есть.
  const lessonQuiz = await db.quiz.findFirst({
    where: { lessonId, kind: "LESSON_QUIZ", status: "PUBLISHED" },
    select: { id: true, title: true },
  });

  // Доступные дорожки субтитров + язык по умолчанию из профиля.
  const [subtitleTracks, viewer] = await Promise.all([
    db.subtitleTrack.findMany({
      where: { lessonId, validation: "VALIDATED" },
      select: { lang: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { subtitleLang: true } }),
  ]);
  const LANG_LABELS: Record<string, string> = { RU: "Русский", KK: "Қазақша", EN: "English", UZ: "Oʻzbekcha" };
  const langOrder = ["RU", "KK", "EN", "UZ"];
  const subtitles = subtitleTracks
    .map((t) => ({ lang: t.lang as "RU" | "KK" | "EN" | "UZ", label: LANG_LABELS[t.lang] ?? t.lang }))
    .sort((a, b) => langOrder.indexOf(a.lang) - langOrder.indexOf(b.lang));

  // Оглавление + плоский порядок доступных уроков для prev/next.
  const flat: { id: string; title: string }[] = [];
  const modules: SidebarModule[] = course.modules.map((m) => ({
    title: m.title,
    lessons: m.lessons.map((l) => {
      const available = l.status === "PUBLISHED";
      if (available) flat.push({ id: l.id, title: l.title });
      return {
        id: l.id,
        title: l.title,
        available,
        completed: completedSet.has(l.id),
      };
    }),
  }));

  const current = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!current) notFound();

  const idx = flat.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[260px_1fr]">
      {/* Сайдбар-оглавление (на мобильном — свёрнутая плашка над уроком) */}
      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <Link
          href="/app"
          className="mb-4 inline-flex items-center gap-1.5 px-3 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <LayoutGrid className="size-4" />
          Моё обучение
        </Link>
        <CourseOutline
          courseSlug={courseSlug}
          courseTitle={course.title}
          modules={modules}
          currentLessonId={lessonId}
          position={{ index: idx + 1, total: flat.length }}
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
            startPositionSec={lessonPos?.lastPositionSec ?? 0}
            summary={summary}
            transcript={transcriptText}
            slides={slides}
            flashcards={flashcards}
            objections={objections}
            branching={branching}
            checklist={checklist}
            script={script}
            audit={audit}
            hotspot={hotspot}
            simulation={simulation}
            voiceEnabled={env.VOICE_ENABLED}
            avatarUrl={env.AVATAR_ENABLED ? "/avatars/doctor.glb" : null}
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
          {next ? (
            <Link
              href={`/app/learn/${courseSlug}/${next.id}`}
              className={buttonVariants({ variant: "accent", size: "sm" })}
            >
              Следующий урок
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      </main>
    </div>
  );
}
