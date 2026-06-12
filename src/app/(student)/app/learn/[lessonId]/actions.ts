"use server";

import { z } from "zod";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { canAccessLesson } from "@/lib/access";

/**
 * Сохранение прогресса просмотра урока (CLAUDE.md S2.2): upsert LessonProgress
 * каждые ~10 с и на паузу. completedAt выставляется при просмотре ≥ 90% длительности.
 * Доступ к уроку проверяется через lib/access (нельзя писать прогресс по чужому уроку).
 */
export const saveLessonProgress = safeAction(
  {
    schema: z.object({
      lessonId: z.string().min(1),
      positionSec: z.number().int().nonnegative(),
      watchedSec: z.number().int().nonnegative(),
    }),
    auth: "user",
  },
  async ({ lessonId, positionSec, watchedSec }, { session }) => {
    const userId = session!.user.id;

    const access = await canAccessLesson(userId, lessonId);
    if (!access.ok) throw new Error("Нет доступа к уроку");

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { durationSec: true },
    });
    const duration = lesson?.durationSec ?? 0;
    const completed = duration > 0 && positionSec >= duration * 0.9;

    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        lastPositionSec: positionSec,
        watchedSec,
        completedAt: completed ? new Date() : null,
      },
      update: {
        lastPositionSec: positionSec,
        watchedSec: { increment: watchedSec },
        ...(completed ? { completedAt: new Date() } : {}),
      },
    });

    return { completed };
  },
);
