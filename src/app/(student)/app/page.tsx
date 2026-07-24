import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, PlayCircle, GraduationCap, Trophy, CalendarCheck, Layers, StickyNote, Info } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isEnrollmentActive } from "@/lib/access";
import { coverPublicUrl } from "@/lib/utils";
import { courseProgress, nextLesson } from "@/lib/learn/progress";
import { ProgressPanel, type BadgeView } from "@/components/gamification/progress-panel";
import { DailyQuests } from "@/components/gamification/daily-quests";
import { WeeklyGoal } from "@/components/gamification/weekly-goal";
import { OnboardingTour } from "@/components/student/onboarding-tour";
import { dailyQuests } from "@/lib/gamification/quests";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Моё обучение",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireUser();
  const userId = session.user.id;
  const isOwner = session.user.role === "OWNER";
  const now = new Date();

  // Срез курса, нужный кабинету (одинаков для ученика и владельца).
  const courseSelect = {
    id: true,
    slug: true,
    title: true,
    coverUrl: true,
    industry: true,
    modules: {
      orderBy: { sortOrder: "asc" as const },
      select: {
        lessons: {
          where: { status: "PUBLISHED" as const },
          orderBy: { sortOrder: "asc" as const },
          select: { id: true, title: true },
        },
      },
    },
    quizzes: {
      where: { kind: "FINAL_EXAM" as const, status: "PUBLISHED" as const },
      select: { id: true },
      take: 1,
    },
  };

  // Список курсов кабинета: у ученика — активные записи, у владельца — все
  // опубликованные (OWNER имеет доступ к любому контенту по роли, lib/access).
  const accessibleCourses = isOwner
    ? await db.course.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
        select: courseSelect,
      })
    : (
        await db.enrollment.findMany({
          where: { userId },
          select: {
            startsAt: true,
            expiresAt: true,
            revokedAt: true,
            course: { select: courseSelect },
          },
        })
      )
        .filter((e) =>
          isEnrollmentActive(
            { startsAt: e.startsAt, expiresAt: e.expiresAt, revokedAt: e.revokedAt },
            now,
          ),
        )
        .map((e) => e.course);

  // Прогресс по всем урокам пользователя одним запросом.
  const completed = await db.lessonProgress.findMany({
    where: { userId, completedAt: { not: null } },
    select: { lessonId: true },
  });
  const completedSet = new Set(completed.map((c) => c.lessonId));

  // Сводка: уроков завершено за последние 7 дней + последняя активность (для «Продолжить»).
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [weeklyDone, lastActivity] = await Promise.all([
    db.lessonProgress.count({ where: { userId, completedAt: { gte: weekAgo } } }),
    db.lessonProgress.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { lesson: { select: { module: { select: { course: { select: { slug: true } } } } } } },
    }),
  ]);
  const recentSlug = lastActivity?.lesson.module.course.slug ?? null;

  const courses = accessibleCourses.map((course) => {
    const lessons = course.modules
      .flatMap((m) => m.lessons)
      .map((l) => ({ id: l.id, title: l.title, completed: completedSet.has(l.id) }));
    const progress = courseProgress(lessons);
    const next = nextLesson(lessons);
    return {
      ...course,
      progress,
      nextLessonId: next?.id ?? null,
      nextLessonTitle: next?.title ?? null,
      examId: course.quizzes[0]?.id ?? null,
    };
  });

  // Герой «Продолжить»: курс с недавней активностью и незавершённый, иначе — первый с уроком.
  const inProgress = courses.filter((c) => c.nextLessonId && c.progress.completed > 0);
  const resume =
    inProgress.find((c) => c.slug === recentSlug) ?? inProgress[0] ?? null;

  // Ближайший к завершению курс (для метрики «до сертификата»).
  const closest = courses
    .filter((c) => c.progress.total > 0 && c.progress.percent < 100)
    .sort((a, b) => b.progress.percent - a.progress.percent)[0] ?? null;

  // Геймификация (сдержанно): профиль + бейджи + учебная цель.
  const [profile, allBadges, earnedBadges, quests, viewer] = await Promise.all([
    db.gamificationProfile.findUnique({ where: { userId }, select: { xp: true, streakDays: true } }),
    db.badge.findMany({ orderBy: { id: "asc" }, select: { code: true, title: true, description: true } }),
    db.userBadge.findMany({ where: { userId }, select: { badge: { select: { code: true } } } }),
    dailyQuests(userId),
    db.user.findUnique({ where: { id: userId }, select: { weeklyGoal: true, onboardedAt: true } }),
  ]);
  const weeklyGoal = viewer?.weeklyGoal ?? 3;
  const showOnboarding = !viewer?.onboardedAt;
  const earnedCodes = new Set(earnedBadges.map((b) => b.badge.code));
  const badgeViews: BadgeView[] = allBadges.map((b) => ({ ...b, earned: earnedCodes.has(b.code) }));

  // Курс пройден на 100% (для корректной метрики «до сертификата»).
  const hasCompletedCourse = courses.some((c) => c.progress.total > 0 && c.progress.percent === 100);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {showOnboarding ? <OnboardingTour /> : null}
      <div>
        <h1 className="text-2xl font-bold">Моё обучение</h1>
        <p className="mt-1 text-foreground/60">
          Здравствуйте, {session.user.name ?? session.user.email}
        </p>
        {isOwner ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
            Режим владельца — доступны все опубликованные курсы
          </p>
        ) : null}
      </div>

      {/* Герой «Продолжить обучение» — туда, где остановился ученик */}
      {resume ? (
        <Link
          href={`/app/learn/${resume.slug}/${resume.nextLessonId}`}
          className="group mt-6 flex flex-col gap-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-5 transition-colors hover:from-amber-500/[0.14] sm:flex-row sm:items-center"
        >
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 sm:w-44">
            {coverPublicUrl(resume.coverUrl, resume.id) ? (
              <Image src={coverPublicUrl(resume.coverUrl, resume.id)!} alt={resume.title} fill className="object-cover" sizes="176px" />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="size-10 text-white/90 drop-shadow transition-transform group-hover:scale-110" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Продолжить обучение</p>
            <h2 className="mt-1 truncate text-lg font-bold">{resume.title}</h2>
            {resume.nextLessonTitle ? (
              <p className="mt-0.5 truncate text-sm text-foreground/60">Дальше: {resume.nextLessonTitle}</p>
            ) : null}
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-foreground/10"
                role="progressbar"
                aria-valuenow={resume.progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Прогресс по курсу «${resume.title}»`}
              >
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${resume.progress.percent}%` }} />
              </div>
              <span className="shrink-0 text-xs text-foreground/60">{resume.progress.percent}%</span>
            </div>
          </div>
          <span className="hidden shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors group-hover:bg-amber-400 sm:inline-flex">
            <PlayCircle className="size-4" />
            Продолжить
          </span>
        </Link>
      ) : null}

      {/* Сводка прогресса: уроки за неделю · активные курсы · ближайший сертификат */}
      {courses.length > 0 ? (
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-foreground/10 bg-background p-3 sm:p-4">
            <CalendarCheck className="size-5 text-emerald-600" />
            <p className="mt-2 text-xl font-bold sm:text-2xl">{weeklyDone}</p>
            <p className="text-xs text-foreground/60">уроков за неделю</p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background p-3 sm:p-4">
            <Layers className="size-5 text-sky-600" />
            <p className="mt-2 text-xl font-bold sm:text-2xl">{courses.length}</p>
            <p className="text-xs text-foreground/60">{courses.length === 1 ? "активный курс" : "активных курсов"}</p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background p-3 sm:p-4">
            <Trophy className="size-5 text-amber-600" />
            <p className="mt-2 text-xl font-bold sm:text-2xl">
              {closest ? `${closest.progress.percent}%` : hasCompletedCourse ? "✓" : "—"}
            </p>
            <p className="text-xs text-foreground/60">
              {closest ? "до сертификата" : hasCompletedCourse ? "курс пройден" : "продолжайте учиться"}
            </p>
          </div>
        </div>
      ) : null}

      {/* Учебная цель недели + сдержанный блок прогресса (полная версия — в «Достижениях») */}
      {courses.length > 0 ? (
        <>
          <div className="mt-5">
            <WeeklyGoal done={weeklyDone} goal={weeklyGoal} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ProgressPanel xp={profile?.xp ?? 0} streakDays={profile?.streakDays ?? 0} badges={badgeViews} compact />
            <DailyQuests quests={quests} />
          </div>
          <Link
            href="/app/notes"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background p-4 transition-colors hover:bg-foreground/[0.03]"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
              <StickyNote className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Мои заметки</p>
              <p className="text-sm text-foreground/60">Все заметки по урокам с переходом к моменту видео</p>
            </div>
          </Link>
        </>
      ) : null}

      {courses.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <BookOpen className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">
            {isOwner ? "Опубликованных курсов пока нет" : "У вас пока нет курсов"}
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            {isOwner ? (
              <>
                Опубликуйте курс в{" "}
                <Link href="/admin/courses" className="text-amber-700 hover:underline">
                  консоли
                </Link>
                , чтобы он появился здесь.
              </>
            ) : (
              <>
                Доступ выдаёт администратор после оплаты.{" "}
                <Link href="/courses" className="text-amber-700 hover:underline">
                  Посмотреть каталог
                </Link>
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <h2 className="mt-10 text-lg font-bold">
            {isOwner ? "Опубликованные курсы" : "Доступные мне курсы"}
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {courses.map((c) => (
            <div
              key={c.slug}
              className="overflow-hidden rounded-2xl border border-foreground/10 bg-background"
            >
              <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-900">
                {coverPublicUrl(c.coverUrl, c.id) ? (
                  <Image
                    src={coverPublicUrl(c.coverUrl, c.id)!}
                    alt={c.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                ) : null}
              </div>
              <div className="p-5">
                <h2 className="font-semibold">{c.title}</h2>

                {/* Прогресс-бар */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-foreground/60">
                    <span>
                      Пройдено {c.progress.completed} из {c.progress.total}
                    </span>
                    <span>{c.progress.percent}%</span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/10"
                    role="progressbar"
                    aria-valuenow={c.progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Прогресс по курсу «${c.title}»`}
                  >
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${c.progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {c.nextLessonId ? (
                    <Link
                      href={`/app/learn/${c.slug}/${c.nextLessonId}`}
                      className={buttonVariants({ variant: "accent", size: "sm" })}
                    >
                      <PlayCircle className="size-4" />
                      {c.progress.completed > 0 ? "Продолжить" : "Начать обучение"}
                    </Link>
                  ) : (
                    <p className="text-sm text-foreground/60">Уроки скоро появятся</p>
                  )}
                  {c.examId ? (
                    <Link
                      href={`/app/quiz/${c.examId}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <GraduationCap className="size-4" />
                      Итоговый тест
                    </Link>
                  ) : null}
                  <Link
                    href={`/courses/${c.slug}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Info className="size-4" />
                    О курсе
                  </Link>
                </div>
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </main>
  );
}
