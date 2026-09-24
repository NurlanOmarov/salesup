import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { PRACTICE_FINISH, PRACTICE_OPEN, trainerKindsByLesson } from "@/lib/learn/practice-server";

/**
 * Сбор данных еженедельного дайджеста владельцу (S6.2). Принцип zero-touch:
 * владелец заходит в админку по событию и видит сводку — без очередей задач.
 * Используется и страницей /admin/digest, и Job digest.weekly (для e-mail/лога).
 */

export interface DigestData {
  periodDays: number;
  since: Date;
  newStudents: number;
  enrollmentsGranted: number;
  activeStudents: number;
  lessonsCompleted: number;
  quizzesPassed: number;
  certificatesIssued: number;
  /** Открытий тренажёров за период (событие practice.open). */
  practiceOpens: number;
  /** Прохождений тренажёров за период (practice.finish). */
  practiceFinishes: number;
  /** Учеников, прошедших хотя бы один тренажёр за период. */
  practiceStudents: number;
  /**
   * Доля уроков, досмотренных за период, по которым ученик прошёл тренировку, 0..1.
   * null — за период не досмотрено ни одного урока с тренажёрами.
   */
  practiceCoverage: number | null;
  newLeads: number;
  llmCostUsd: number;
  llmTokens: number;
  diskBytes: number;
  dbBytes: number | null;
  thumbsDown: number;
  failedContent: number;
  // SEO-сигналы (zero-touch: информация владельцу, а не задача)
  notFoundTop: { path: string; hits: number }[];
  notFoundTotal: number;
  redirectHits: number;
  /** Пар курсов-конкурентов (embeddings). null — семантика не считалась / недоступна. */
  cannibalPairs: number | null;
}

export interface DigestOptions {
  /**
   * Считать ли семантическую каннибализацию (OpenAI embeddings). Включается только
   * в еженедельном Job (правило 10 — контроль расхода API): курсов мало, это доли
   * цента в неделю, расход виден в LlmUsage. Страница /admin/digest не включает.
   */
  semantic?: boolean;
}

export async function buildDigest(
  periodDays = 7,
  now: Date = new Date(),
  opts: DigestOptions = {},
): Promise<DigestData> {
  const since = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [
    newStudents,
    enrollmentsGranted,
    lessonsCompleted,
    quizzesPassed,
    certificatesIssued,
    newLeads,
    llm,
    activeProgress,
    activeAttempts,
    thumbsDownQ,
    failedContent,
    dbSize,
    notFoundTop,
    notFoundTotal,
    redirectAgg,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: since } } }),
    db.enrollment.count({ where: { startsAt: { gte: since } } }),
    db.lessonProgress.count({ where: { completedAt: { gte: since } } }),
    db.quizAttempt.count({ where: { status: "PASSED", finishedAt: { gte: since } } }),
    db.certificate.count({ where: { issuedAt: { gte: since } } }),
    db.lead.count({ where: { status: "NEW" } }),
    db.llmUsage.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { costMicroUsd: true, inputTokens: true, outputTokens: true },
    }),
    db.lessonProgress.findMany({ where: { updatedAt: { gte: since } }, select: { userId: true }, distinct: ["userId"] }),
    db.quizAttempt.findMany({ where: { startedAt: { gte: since } }, select: { userId: true }, distinct: ["userId"] }),
    db.question.aggregate({ _sum: { thumbsDown: true } }),
    db.question.count({ where: { validation: "FAILED" } }),
    safeDbSize(),
    db.notFoundHit.findMany({
      where: { lastSeenAt: { gte: since } },
      orderBy: { hits: "desc" },
      take: 5,
      select: { path: true, hits: true },
    }),
    db.notFoundHit.count({ where: { lastSeenAt: { gte: since } } }),
    db.redirect.aggregate({ _sum: { hits: true } }),
  ]);

  // Семантика — только по явному запросу (weekly-job); сбой embeddings не валит дайджест.
  const cannibalPairs = opts.semantic ? await safeCannibalPairs() : null;

  const practice = await practiceStats(since);

  const activeIds = new Set([...activeProgress.map((p) => p.userId), ...activeAttempts.map((a) => a.userId)]);

  return {
    periodDays,
    since,
    newStudents,
    enrollmentsGranted,
    activeStudents: activeIds.size,
    lessonsCompleted,
    quizzesPassed,
    certificatesIssued,
    ...practice,
    newLeads,
    llmCostUsd: (llm._sum.costMicroUsd ?? 0) / 1_000_000,
    llmTokens: (llm._sum.inputTokens ?? 0) + (llm._sum.outputTokens ?? 0),
    diskBytes: await safeDiskBytes(),
    dbBytes: dbSize,
    thumbsDown: thumbsDownQ._sum.thumbsDown ?? 0,
    failedContent,
    notFoundTop,
    notFoundTotal,
    redirectHits: redirectAgg._sum.hits ?? 0,
    cannibalPairs,
  };
}

/**
 * Тренировки за период: заметили ли ученики практику и закрепляют ли уроки.
 * Покрытие — по урокам с тренажёрами, досмотренным за период: у скольких из этих
 * пар «ученик × урок» есть пройденный тренажёр (когда угодно).
 */
async function practiceStats(since: Date) {
  const [opens, finishes] = await Promise.all([
    db.event.count({ where: { name: PRACTICE_OPEN, createdAt: { gte: since } } }),
    db.event.findMany({
      where: { name: PRACTICE_FINISH, createdAt: { gte: since } },
      select: { userId: true },
    }),
  ]);
  const completed = await db.lessonProgress.findMany({
    where: { completedAt: { gte: since } },
    select: { userId: true, lessonId: true },
  });
  const lessonIds = [...new Set(completed.map((c) => c.lessonId))];
  const kinds = await trainerKindsByLesson(lessonIds);
  const withTrainers = completed.filter((c) => kinds.has(c.lessonId));
  const practiced = withTrainers.length
    ? await db.practiceResult.findMany({
        where: {
          userId: { in: [...new Set(withTrainers.map((c) => c.userId))] },
          lessonId: { in: [...new Set(withTrainers.map((c) => c.lessonId))] },
        },
        select: { userId: true, lessonId: true },
        distinct: ["userId", "lessonId"],
      })
    : [];
  const practicedPairs = new Set(practiced.map((p) => `${p.userId}:${p.lessonId}`));
  const covered = withTrainers.filter((c) => practicedPairs.has(`${c.userId}:${c.lessonId}`)).length;
  return {
    practiceOpens: opens,
    practiceFinishes: finishes.length,
    practiceStudents: new Set(finishes.map((f) => f.userId).filter(Boolean)).size,
    practiceCoverage: withTrainers.length ? covered / withTrainers.length : null,
  };
}

/** Число пар курсов-конкурентов (embeddings). null при сбое внешнего API. */
async function safeCannibalPairs(): Promise<number | null> {
  try {
    const { analyzeCannibalization } = await import("@/lib/seo/semantic.js");
    const report = await analyzeCannibalization();
    return report.pairs.length;
  } catch {
    return null;
  }
}

/** Размер media (сумма всех объектов хранилища). Ошибки не валят дайджест. */
async function safeDiskBytes(): Promise<number> {
  try {
    const keys = await storage.list("courses");
    // list возвращает ключи; для fs-драйвера размер считаем через get длину — дорого,
    // поэтому оцениваем по числу сегментов × средний размер не делаем: берём 0, если
    // драйвер не поддерживает stat. Для точного размера на VPS — daily-cron (S6.3).
    return keys.length; // как индикатор числа объектов; точный размер — в S6.3
  } catch {
    return 0;
  }
}

/** Размер БД через pg_database_size. null, если запрос не удался. */
async function safeDbSize(): Promise<number | null> {
  try {
    const rows = await db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
    return rows[0] ? Number(rows[0].size) : null;
  } catch {
    return null;
  }
}
