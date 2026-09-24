import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { awardXp, awardBadge, touchStreak } from "@/lib/gamification/award";
import { XP_REWARDS } from "@/lib/gamification/levels";
import {
  TRAINER_ARTIFACT_TYPES,
  pickMainTrainer,
  type PracticeKind,
} from "@/lib/learn/practice";

/**
 * Учёт тренажёров на сервере: результаты (PracticeResult), события в Event,
 * награды и «допуск практикой» к итоговому экзамену. Словарь видов — lib/learn/practice.
 */

export const PRACTICE_OPEN = "practice.open";
export const PRACTICE_FINISH = "practice.finish";

/** Ученик открыл тренажёр — событие для аналитики «заметили ли практику». */
export async function recordPracticeOpen(userId: string, lessonId: string, kind: PracticeKind) {
  await db.event.create({ data: { userId, name: PRACTICE_OPEN, meta: { lessonId, kind } } });
}

export interface PracticeRecordResult {
  /** Этот тренажёр пройден впервые (на этом уроке). */
  firstTime: boolean;
  /** Это первый пройденный тренажёр урока — шаг «Тренировка» закрыт сейчас. */
  lessonStepDone: boolean;
  xpGained: number;
  bestScore: number | null;
  /** Сколько тренажёров урока ещё не пройдено (после этой записи). */
  remaining: number;
  /** Этим прохождением закрыты все тренажёры урока — начислен бонус. */
  allDone: boolean;
}

/**
 * Записать прохождение тренажёра. Повторные прохождения копят лучший балл и число
 * прогонов; XP — только за первое прохождение каждого тренажёра урока.
 */
export async function recordPracticeFinish(
  userId: string,
  lessonId: string,
  kind: PracticeKind,
  scorePct: number | null,
): Promise<PracticeRecordResult> {
  const where = { userId_lessonId_kind: { userId, lessonId, kind } };
  const [existing, lessonDoneBefore, available] = await Promise.all([
    db.practiceResult.findUnique({ where, select: { bestScore: true } }),
    db.practiceResult.count({ where: { userId, lessonId } }),
    trainerKindsByLesson([lessonId]).then((m) => m.get(lessonId) ?? new Set<PracticeKind>()),
  ]);

  let firstTime = false;
  let bestScore: number | null;
  if (!existing) {
    try {
      await db.practiceResult.create({
        data: { userId, lessonId, kind, bestScore: scorePct, lastScore: scorePct },
      });
      firstTime = true;
      bestScore = scorePct;
    } catch (e) {
      // Двойная отправка (две вкладки, повтор сети): запись уже есть — это повтор.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      bestScore = await bumpRun(where, scorePct);
    }
  } else {
    bestScore = await bumpRun(where, scorePct, existing.bestScore);
  }

  await db.event.create({
    data: { userId, name: PRACTICE_FINISH, meta: { lessonId, kind, score: scorePct, first: firstTime } },
  });

  const lessonStepDone = firstTime && lessonDoneBefore === 0;
  // Остаток считаем по видам, которые у урока есть сейчас (набор мог смениться).
  const doneKinds = await db.practiceResult.findMany({
    where: { userId, lessonId },
    select: { kind: true },
  });
  const doneSet = new Set(doneKinds.map((r) => r.kind));
  const remaining = [...available].filter((k) => !doneSet.has(k)).length;
  // Бонус — ровно один раз: только на первом прохождении того тренажёра, который
  // закрыл набор (повторные прогоны firstTime не дают). Урок с одним тренажёром
  // бонуса не получает — «все» из одного не достижение.
  const allDone = firstTime && remaining === 0 && available.size > 1;

  let xpGained = 0;
  if (firstTime) {
    xpGained =
      (lessonStepDone ? XP_REWARDS.practiceFirstInLesson : XP_REWARDS.practiceExtra) +
      (allDone ? XP_REWARDS.practiceAllInLesson : 0);
    // Геймификация не должна ронять запись результата.
    try {
      await awardXp(userId, xpGained);
      await touchStreak(userId);
      await awardBadge(userId, "first-practice");
      if (lessonStepDone && (await practicedWholeCourse(userId, lessonId))) {
        await awardBadge(userId, "practice-course");
      }
    } catch (e) {
      console.error("Награды за тренажёр не начислены:", e);
    }
  }

  return { firstTime, lessonStepDone, xpGained, bestScore, remaining, allDone };
}

async function bumpRun(
  where: Prisma.PracticeResultWhereUniqueInput,
  scorePct: number | null,
  prevBest?: number | null,
): Promise<number | null> {
  const prev = prevBest ?? (await db.practiceResult.findUnique({ where, select: { bestScore: true } }))?.bestScore ?? null;
  const best = scorePct == null ? prev : prev == null ? scorePct : Math.max(prev, scorePct);
  await db.practiceResult.update({
    where,
    data: { runs: { increment: 1 }, lastScore: scorePct, bestScore: best },
  });
  return best;
}

/** Все ли уроки курса (этого урока) с тренажёрами отработаны учеником. */
async function practicedWholeCourse(userId: string, lessonId: string): Promise<boolean> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return false;
  const gate = await coursePracticeGate(userId, lesson.module.courseId);
  return gate.total > 0 && gate.missing.length === 0;
}

/**
 * Какие тренажёры есть у уроков: валидированные артефакты-тренажёры + сценарий
 * симулятора. OBJECTIONS даёт ещё и RAPID_FIRE (тот же набор, другой режим).
 */
export async function trainerKindsByLesson(
  lessonIds: string[],
): Promise<Map<string, Set<PracticeKind>>> {
  const map = new Map<string, Set<PracticeKind>>();
  if (lessonIds.length === 0) return map;
  const [artifacts, scenarios] = await Promise.all([
    db.aiArtifact.findMany({
      where: { lessonId: { in: lessonIds }, validation: "VALIDATED", type: { in: [...TRAINER_ARTIFACT_TYPES] } },
      select: { lessonId: true, type: true },
    }),
    db.simulationScenario.findMany({
      where: { lessonId: { in: lessonIds }, validation: "VALIDATED" },
      select: { lessonId: true },
    }),
  ]);
  const add = (lessonId: string, kind: PracticeKind) => {
    const set = map.get(lessonId) ?? new Set<PracticeKind>();
    set.add(kind);
    map.set(lessonId, set);
  };
  for (const a of artifacts) {
    add(a.lessonId, a.type as PracticeKind);
    if (a.type === "OBJECTIONS") add(a.lessonId, "RAPID_FIRE");
  }
  for (const s of scenarios) add(s.lessonId, "SIMULATION");
  return map;
}

/** Уроки, в которых ученик прошёл хотя бы один тренажёр. */
export async function practicedLessonIds(userId: string, lessonIds: string[]): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const rows = await db.practiceResult.findMany({
    where: { userId, lessonId: { in: lessonIds } },
    select: { lessonId: true },
    distinct: ["lessonId"],
  });
  return new Set(rows.map((r) => r.lessonId));
}

export interface PracticeGateLesson {
  lessonId: string;
  title: string;
  mainKind: PracticeKind;
}

/**
 * «Допуск практикой» к итоговому экзамену: в каждом опубликованном уроке курса,
 * где есть тренажёры, пройден хотя бы один. Уроки без тренажёров не мешают.
 */
export async function coursePracticeGate(
  userId: string,
  courseId: string,
): Promise<{ total: number; missing: PracticeGateLesson[] }> {
  const lessons = await db.lesson.findMany({
    where: { status: "PUBLISHED", module: { courseId } },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, title: true },
  });
  const ids = lessons.map((l) => l.id);
  const [kinds, done] = await Promise.all([trainerKindsByLesson(ids), practicedLessonIds(userId, ids)]);
  const withTrainers = lessons.filter((l) => (kinds.get(l.id)?.size ?? 0) > 0);
  const missing = withTrainers
    .filter((l) => !done.has(l.id))
    .map((l) => ({ lessonId: l.id, title: l.title, mainKind: pickMainTrainer(kinds.get(l.id)!)! }));
  return { total: withTrainers.length, missing };
}
