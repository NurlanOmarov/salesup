"use server";

import { z } from "zod";
import { safeAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { canAccessLesson } from "@/lib/access";
import { awardXp, awardBadge, touchStreak } from "@/lib/gamification/award";
import { XP_REWARDS } from "@/lib/gamification/levels";
import { addNote, deleteNote } from "@/lib/learn/notes";

/**
 * Сохранение прогресса просмотра урока (S2.2/S4.2): upsert LessonProgress каждые
 * ~10 с и на паузу. completedAt — при просмотре ≥ 90% длительности. Доступ к уроку
 * проверяется через lib/access (нельзя писать прогресс по чужому уроку).
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

    const [lesson, existing] = await Promise.all([
      db.lesson.findUnique({ where: { id: lessonId }, select: { durationSec: true } }),
      db.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { completedAt: true },
      }),
    ]);
    const duration = lesson?.durationSec ?? 0;
    const completed = duration > 0 && positionSec >= duration * 0.9;
    const justCompleted = completed && !existing?.completedAt;

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

    // Геймификация — только при ПЕРВОМ завершении урока. Не критично к основному потоку.
    if (justCompleted) {
      try {
        await awardXp(userId, XP_REWARDS.lessonCompleted);
        await awardBadge(userId, "first-lesson");
        const streak = await touchStreak(userId);
        if (streak >= 7) await awardBadge(userId, "streak-7");
      } catch (e) {
        console.error("Награды за урок не начислены:", e);
      }
    }

    return { completed };
  },
);

/** Добавить заметку к уроку на текущей секунде видео. */
export const addNoteAction = safeAction(
  {
    schema: z.object({
      lessonId: z.string().min(1),
      timecodeSec: z.number().int().nonnegative(),
      text: z.string().trim().min(1, "Заметка пустая").max(2000),
    }),
    auth: "user",
  },
  async ({ lessonId, timecodeSec, text }, { session }) => {
    return addNote(session!.user.id, lessonId, timecodeSec, text);
  },
);

/** Удалить свою заметку. */
export const deleteNoteAction = safeAction(
  {
    schema: z.object({ noteId: z.string().min(1) }),
    auth: "user",
  },
  async ({ noteId }, { session }) => {
    await deleteNote(session!.user.id, noteId);
    return { ok: true };
  },
);
