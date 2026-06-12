import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { canAccessLesson } from "@/lib/access";
import { SecurePlayer } from "@/components/player/secure-player";

export const metadata: Metadata = {
  title: "Урок",
  robots: { index: false },
};

/**
 * Просмотр урока (S2.2). Полноценный кабинет с оглавлением — в S4.2; здесь
 * минимальная страница: проверка доступа через lib/access + защищённый плеер.
 */
export default async function LearnPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const session = await requireUser();
  const userId = session.user.id;

  const access = await canAccessLesson(userId, lessonId);
  if (!access.ok) notFound();

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      videoStatus: true,
      durationSec: true,
      module: {
        select: {
          title: true,
          course: { select: { slug: true, title: true } },
        },
      },
      progress: {
        where: { userId },
        select: { lastPositionSec: true },
        take: 1,
      },
    },
  });
  if (!lesson) notFound();

  const startPositionSec = lesson.progress[0]?.lastPositionSec ?? 0;
  const watermark = session.user.email ?? userId;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/courses/${lesson.module.course.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {lesson.module.course.title}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{lesson.title}</h1>
      <p className="mt-1 text-sm text-foreground/50">{lesson.module.title}</p>

      <div className="mt-6">
        {lesson.videoStatus === "READY" ? (
          <SecurePlayer
            lessonId={lessonId}
            watermark={watermark}
            startPositionSec={startPositionSec}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] text-foreground/50">
            Видео готовится — загляните позже.
          </div>
        )}
      </div>
    </main>
  );
}
