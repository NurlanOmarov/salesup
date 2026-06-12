import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, PlayCircle, GraduationCap } from "lucide-react";
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
                select: { id: true },
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

  const active = enrollments.filter((e) =>
    isEnrollmentActive({ startsAt: e.startsAt, expiresAt: e.expiresAt, revokedAt: e.revokedAt }, now),
  );

  const courses = active.map((e) => {
    const lessons = e.course.modules
      .flatMap((m) => m.lessons)
      .map((l) => ({ id: l.id, completed: completedSet.has(l.id) }));
    const progress = courseProgress(lessons);
    const next = nextLesson(lessons);
    return {
      ...e.course,
      progress,
      nextLessonId: next?.id ?? null,
      examId: e.course.quizzes[0]?.id ?? null,
    };
  });

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

      {/* Сдержанный блок прогресса (показываем, если есть курсы) */}
      {courses.length > 0 ? (
        <div className="mt-6">
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
