import { db } from "@/lib/db";

/**
 * История тренировок в AI-симуляторе звонков (SimulationRun). Показывает прогресс
 * навыка: динамику баллов, лучший результат, последние разборы. Только завершённые
 * прогоны (есть итоговый балл).
 */

export interface SimRunView {
  id: string;
  scenarioTitle: string;
  lessonTitle: string;
  courseSlug: string;
  lessonId: string;
  scorePct: number;
  passed: boolean | null;
  createdAt: string;
}

export interface SimStats {
  total: number;
  avgScore: number;
  bestScore: number;
  passedCount: number;
  /** Баллы по времени (старые → новые) для мини-графика динамики. */
  trend: number[];
}

export async function listSimulationRuns(userId: string, limit = 30): Promise<SimRunView[]> {
  const runs = await db.simulationRun.findMany({
    where: { userId, scorePct: { not: null } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      scorePct: true,
      passed: true,
      createdAt: true,
      scenario: {
        select: {
          title: true,
          lesson: {
            select: { id: true, title: true, module: { select: { course: { select: { slug: true } } } } },
          },
        },
      },
    },
  });

  return runs.map((r) => ({
    id: r.id,
    scenarioTitle: r.scenario.title,
    lessonTitle: r.scenario.lesson.title,
    courseSlug: r.scenario.lesson.module.course.slug,
    lessonId: r.scenario.lesson.id,
    scorePct: r.scorePct ?? 0,
    passed: r.passed,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function simulationStats(userId: string): Promise<SimStats> {
  const runs = await db.simulationRun.findMany({
    where: { userId, scorePct: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { scorePct: true, passed: true },
  });

  const scores = runs.map((r) => r.scorePct ?? 0);
  const total = scores.length;
  if (total === 0) return { total: 0, avgScore: 0, bestScore: 0, passedCount: 0, trend: [] };

  const sum = scores.reduce((a, b) => a + b, 0);
  return {
    total,
    avgScore: Math.round(sum / total),
    bestScore: Math.max(...scores),
    passedCount: runs.filter((r) => r.passed).length,
    trend: scores.slice(-12), // последние 12 для графика
  };
}
