import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, PlayCircle, GraduationCap, Trophy, CalendarCheck, Layers } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isEnrollmentActive } from "@/lib/access";
import { courseProgress, nextLesson } from "@/lib/learn/progress";
import { LogoutButton } from "@/components/logout-button";
import { ProgressPanel, type BadgeView } from "@/components/gamification/progress-panel";

export const metadata: Metadata = {
  title: "Моё обучение",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireUser();
  const userId = session.user.id;
  const now = new Date();

  const enrollments = await db.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          slug: true,
          title: true,
          coverUrl: true,
          industry: true,
          modules: {
            orderBy: { sortOrder: "asc" },
            select: {
              lessons: {
                where: { status: "PUBLISHED" },
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true },
              },
            },
          },
          quizzes: {
            where: { kind: "FINAL_EXAM", status: "PUBLISHED" },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

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

  const active = enrollments.filter((e) =>
    isEnrollmentActive({ startsAt: e.startsAt, expiresAt: e.expiresAt, revokedAt: e.revokedAt }, now),
  );

  const courses = active.map((e) => {
    const lessons = e.course.modules
      .flatMap((m) => m.lessons)
      .map((l) => ({ id: l.id, title: l.title, completed: completedSet.has(l.id) }));
    const progress = courseProgress(lessons);
    const next = nextLesson(lessons);
    return {
      ...e.course,
      progress,
      nextLessonId: next?.id ?? null,
      nextLessonTitle: next?.title ?? null,
      examId: e.course.quizzes[0]?.id ?? null,
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

  // Геймификация (сдержанно): профиль + бейджи.
  const [profile, allBadges, earnedBadges] = await Promise.all([
    db.gamificationProfile.findUnique({ where: { userId }, select: { xp: true, streakDays: true } }),
    db.badge.findMany({ orderBy: { id: "asc" }, select: { code: true, title: true, description: true } }),
    db.userBadge.findMany({ where: { userId }, select: { badge: { select: { code: true } } } }),
  ]);
  const earnedCodes = new Set(earnedBadges.map((b) => b.badge.code));
  const badgeViews: BadgeView[] = allBadges.map((b) => ({ ...b, earned: earnedCodes.has(b.code) }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Моё обучение</h1>
          <p className="mt-1 text-foreground/60">
            Здравствуйте, {session.user.name ?? session.user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/achievements"
            className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            Достижения
          </Link>
          <Link
            href="/app/certificates"
            className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            Сертификаты
          </Link>
          <Link
            href="/app/settings"
            className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            Настройки
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* Герой «Продолжить обучение» — туда, где остановился ученик */}
      {resume ? (
        <Link
          href={`/app/learn/${resume.slug}/${resume.nextLessonId}`}
          className="group mt-6 flex flex-col gap-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-5 transition-colors hover:from-amber-500/[0.14] sm:flex-row sm:items-center"
        >
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 sm:w-44">
            {resume.coverUrl ? (
              <Image src={resume.coverUrl} alt={resume.title} fill className="object-cover" sizes="176px" />
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
              <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-foreground/10">
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
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-foreground/10 bg-background p-4">
            <CalendarCheck className="size-5 text-emerald-600" />
            <p className="mt-2 text-2xl font-bold">{weeklyDone}</p>
            <p className="text-xs text-foreground/55">уроков за неделю</p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background p-4">
            <Layers className="size-5 text-sky-600" />
            <p className="mt-2 text-2xl font-bold">{courses.length}</p>
            <p className="text-xs text-foreground/55">{courses.length === 1 ? "активный курс" : "активных курсов"}</p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-background p-4">
            <Trophy className="size-5 text-amber-600" />
            <p className="mt-2 text-2xl font-bold">{closest ? `${closest.progress.percent}%` : "—"}</p>
            <p className="text-xs text-foreground/55">{closest ? "до сертификата" : "сертификат получен"}</p>
          </div>
        </div>
      ) : null}

      {/* Сдержанный блок прогресса (показываем, если есть курсы) */}
      {courses.length > 0 ? (
        <div className="mt-5">
          <ProgressPanel xp={profile?.xp ?? 0} streakDays={profile?.streakDays ?? 0} badges={badgeViews} />
        </div>
      ) : null}

      {courses.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <BookOpen className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">У вас пока нет курсов</p>
          <p className="mt-1 text-sm text-foreground/60">
            Доступ выдаёт администратор после оплаты.{" "}
            <Link href="/courses" className="text-amber-700 hover:underline">
              Посмотреть каталог
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {courses.map((c) => (
            <div
              key={c.slug}
              className="overflow-hidden rounded-2xl border border-foreground/10 bg-background"
            >
              <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-900">
                {c.coverUrl ? (
                  <Image
                    src={c.coverUrl}
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
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/10">
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
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
                    >
                      <PlayCircle className="size-4" />
                      {c.progress.completed > 0 ? "Продолжить" : "Начать обучение"}
                    </Link>
                  ) : (
                    <p className="text-sm text-foreground/50">Уроки скоро появятся</p>
                  )}
                  {c.examId ? (
                    <Link
                      href={`/app/quiz/${c.examId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
                    >
                      <GraduationCap className="size-4" />
                      Итоговый тест
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
