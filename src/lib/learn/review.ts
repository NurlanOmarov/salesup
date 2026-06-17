import { db } from "@/lib/db";
import { parseFlashcards } from "@/lib/interactive";

/**
 * Тренажёр интервального повторения флеш-карточек (Leitner-lite). Карточки берутся
 * из существующих FLASHCARDS-артефактов доступных ученику курсов; прогресс хранится
 * в CardReview по паре (artifactId, cardIndex). LLM не используется — повторение
 * чистой механикой по dueAt (CLAUDE.md: один сервер, без сторонних сервисов).
 */

/** Интервалы по ступеням Leitner (дни). Box=0 — новая/проваленная карточка. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 30] as const;
export const MAX_BOX = REVIEW_INTERVALS_DAYS.length; // 4 — карточка «выучена»
export const DAILY_REVIEW_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  box: number;
  repetitions: number;
  lapses: number;
}

export interface NextReview extends ReviewState {
  dueAt: Date;
  lastResult: boolean;
}

/**
 * Чистый расчёт следующего состояния карточки по ответу ученика.
 * «Запомнил» → шаг вверх по Leitner и интервал текущей ступени; «не помню» →
 * сброс в box 0, +1 lapse, повтор завтра. Юнит-тестируемо (без БД/времени-сайд-эффектов).
 */
export function nextReviewState(prev: ReviewState, remembered: boolean, now: Date): NextReview {
  if (remembered) {
    const box = Math.min(prev.box + 1, MAX_BOX);
    const lastInterval = REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1] ?? 30;
    const intervalDays = REVIEW_INTERVALS_DAYS[box - 1] ?? lastInterval;
    return {
      box,
      repetitions: prev.repetitions + 1,
      lapses: prev.lapses,
      dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
      lastResult: true,
    };
  }
  return {
    box: 0,
    repetitions: prev.repetitions + 1,
    lapses: prev.lapses + 1,
    dueAt: new Date(now.getTime() + REVIEW_INTERVALS_DAYS[0] * DAY_MS),
    lastResult: false,
  };
}

/** id активных (не отозванных/не истёкших) курсов ученика на момент now. */
async function activeCourseIds(userId: string, now: Date): Promise<string[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { courseId: true },
  });
  return enrollments.map((e) => e.courseId);
}

/**
 * Засеять недостающие CardReview для всех FLASHCARDS доступных курсов ученика.
 * Идемпотентно (createMany skipDuplicates по unique). Новые карточки доступны сразу.
 */
export async function seedReviewsForUser(userId: string, now = new Date()): Promise<number> {
  const courseIds = await activeCourseIds(userId, now);
  if (courseIds.length === 0) return 0;

  const artifacts = await db.aiArtifact.findMany({
    where: { type: "FLASHCARDS", validation: "VALIDATED", lesson: { module: { courseId: { in: courseIds } } } },
    select: { id: true, content: true },
  });

  const rows: { userId: string; artifactId: string; cardIndex: number; dueAt: Date }[] = [];
  for (const a of artifacts) {
    const deck = parseFlashcards(a.content);
    if (!deck) continue;
    deck.cards.forEach((_, i) => rows.push({ userId, artifactId: a.id, cardIndex: i, dueAt: now }));
  }
  if (rows.length === 0) return 0;

  const res = await db.cardReview.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

export interface DueCard {
  artifactId: string;
  cardIndex: number;
  front: string;
  back: string;
  lessonTitle: string;
}

/** Карточки, у которых наступил срок повторения (dueAt ≤ now), в пределах дневной нормы. */
export async function getDueCards(userId: string, now = new Date(), limit = DAILY_REVIEW_LIMIT): Promise<DueCard[]> {
  const courseIds = await activeCourseIds(userId, now);
  if (courseIds.length === 0) return [];

  const reviews = await db.cardReview.findMany({
    where: {
      userId,
      dueAt: { lte: now },
      artifact: { validation: "VALIDATED", lesson: { module: { courseId: { in: courseIds } } } },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
    select: {
      artifactId: true,
      cardIndex: true,
      artifact: { select: { content: true, lesson: { select: { title: true } } } },
    },
  });

  const out: DueCard[] = [];
  for (const r of reviews) {
    const deck = parseFlashcards(r.artifact.content);
    const card = deck?.cards[r.cardIndex];
    if (!card) continue; // карточка исчезла после регенерации артефакта — пропускаем
    out.push({
      artifactId: r.artifactId,
      cardIndex: r.cardIndex,
      front: card.front,
      back: card.back,
      lessonTitle: r.artifact.lesson.title,
    });
  }
  return out;
}

/** Сводка для бейджа навигации: сколько карточек к повторению сейчас. */
export async function dueCount(userId: string, now = new Date()): Promise<number> {
  const courseIds = await activeCourseIds(userId, now);
  if (courseIds.length === 0) return 0;
  return db.cardReview.count({
    where: {
      userId,
      dueAt: { lte: now },
      artifact: { validation: "VALIDATED", lesson: { module: { courseId: { in: courseIds } } } },
    },
  });
}

/** Записать результат ответа по карточке и пересчитать срок следующего повторения. */
export async function gradeCard(
  userId: string,
  artifactId: string,
  cardIndex: number,
  remembered: boolean,
  now = new Date(),
): Promise<{ dueAt: Date; box: number } | null> {
  const current = await db.cardReview.findUnique({
    where: { userId_artifactId_cardIndex: { userId, artifactId, cardIndex } },
    select: { id: true, box: true, repetitions: true, lapses: true },
  });
  if (!current) return null;

  const next = nextReviewState(current, remembered, now);
  await db.cardReview.update({
    where: { id: current.id },
    data: {
      box: next.box,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastResult: next.lastResult,
    },
  });
  return { dueAt: next.dueAt, box: next.box };
}
