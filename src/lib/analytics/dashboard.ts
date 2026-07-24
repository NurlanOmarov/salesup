import "server-only";
import { differenceInCalendarDays, eachDayOfInterval, endOfDay, startOfDay, subMilliseconds } from "date-fns";
import { db } from "@/lib/db";
import { PAGE_VIEW } from "@/lib/analytics/collect";

/**
 * Аналитика лендинга поверх своей таблицы Event (D-002) + Lead/Enrollment.
 * Всё считается за произвольный [from, to], опционально сравнивается с предыдущим
 * периодом такой же длины. Внешние счётчики (GA4/Метрика) сюда не привлекаются —
 * страны/источники берём из своих page.view (правило 9: без IP и ПДн).
 */

// ——— типы результата (потребляются UI) —————————————————————————————————

export type Metric = {
  /** Значение за выбранный период. */
  value: number;
  /** Значение за предыдущий период (null, если сравнение выключено). */
  prev: number | null;
  /** Прирост в % относительно prev (null — нет базы для сравнения). */
  deltaPct: number | null;
};

export type TimePoint = {
  /** ISO-дата дня. */
  date: string;
  views: number;
  visitors: number;
  /** Значения предыдущего периода, выровненные по порядковому дню (для наложения). */
  prevViews: number | null;
  prevVisitors: number | null;
};

export type CoursePopularity = {
  slug: string;
  title: string;
  views: number;
  visitors: number;
  leads: number;
  enrollments: number;
  /** Конверсия просмотр→запись, %. */
  conversion: number;
};

export type NamedCount = { key: string; label: string; value: number; visitors?: number };

export type Funnel = {
  views: number;
  courseViews: number;
  leads: number;
  enrollments: number;
};

/** Мини-ряды по дням для спарклайнов KPI (выровнены по дням текущего периода). */
export type Sparks = {
  visitors: number[];
  views: number[];
  leads: number[];
  enrollments: number[];
  conversion: number[];
};

export type Dashboard = {
  range: { from: string; to: string; days: number; compare: boolean };
  kpis: {
    visitors: Metric;
    views: Metric;
    leads: Metric;
    enrollments: Metric;
    conversion: Metric; // заявки / посетители, %
  };
  sparks: Sparks;
  timeseries: TimePoint[];
  courses: CoursePopularity[];
  countries: NamedCount[];
  pages: NamedCount[];
  sources: NamedCount[];
  funnel: Funnel;
};

// ——— низкоуровневые запросы ————————————————————————————————————————

type Totals = { views: number; visitors: number };

async function totals(from: Date, to: Date): Promise<Totals> {
  const rows = await db.$queryRaw<{ views: number; visitors: number }[]>`
    SELECT count(*)::int AS views,
           count(distinct meta->>'v')::int AS visitors
    FROM "Event"
    WHERE name = ${PAGE_VIEW} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
  `;
  return rows[0] ?? { views: 0, visitors: 0 };
}

async function dailySeries(from: Date, to: Date): Promise<Map<string, Totals>> {
  const rows = await db.$queryRaw<{ day: Date; views: number; visitors: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day,
           count(*)::int AS views,
           count(distinct meta->>'v')::int AS visitors
    FROM "Event"
    WHERE name = ${PAGE_VIEW} AND "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1 ORDER BY 1
  `;
  const map = new Map<string, Totals>();
  for (const r of rows) {
    map.set(dayKey(r.day), { views: r.views, visitors: r.visitors });
  }
  return map;
}

async function countByMeta(
  from: Date,
  to: Date,
  field: "country" | "path" | "ref" | "slug",
  limit: number,
): Promise<{ key: string; value: number; visitors: number }[]> {
  // field жёстко ограничен union-типом выше — безопасно интерполировать в json-путь.
  const rows = await db.$queryRawUnsafe<{ key: string; value: number; visitors: number }[]>(
    `SELECT meta->>'${field}' AS key,
            count(*)::int AS value,
            count(distinct meta->>'v')::int AS visitors
     FROM "Event"
     WHERE name = $1 AND "createdAt" >= $2 AND "createdAt" <= $3 AND meta->>'${field}' IS NOT NULL
     GROUP BY 1 ORDER BY value DESC LIMIT ${limit}`,
    PAGE_VIEW,
    from,
    to,
  );
  return rows;
}

// ——— агрегаты Lead / Enrollment ———————————————————————————————————————

async function leadsByCourse(from: Date, to: Date): Promise<{ map: Map<string, number>; total: number }> {
  const groups = await db.lead.groupBy({
    by: ["courseId"],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  let total = 0;
  for (const g of groups) {
    total += g._count._all;
    if (g.courseId) map.set(g.courseId, g._count._all);
  }
  return { map, total };
}

/** Количество записей таблицы по дням (по указанной колонке даты). */
async function dailyCount(table: "Lead" | "Enrollment", dateCol: string, from: Date, to: Date): Promise<Map<string, number>> {
  const rows = await db.$queryRawUnsafe<{ day: Date; c: number }[]>(
    `SELECT date_trunc('day', "${dateCol}") AS day, count(*)::int AS c
     FROM "${table}" WHERE "${dateCol}" >= $1 AND "${dateCol}" <= $2 GROUP BY 1`,
    from,
    to,
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(dayKey(r.day), r.c);
  return map;
}

async function enrollmentsByCourse(from: Date, to: Date): Promise<{ map: Map<string, number>; total: number }> {
  const groups = await db.enrollment.groupBy({
    by: ["courseId"],
    where: { startsAt: { gte: from, lte: to } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  let total = 0;
  for (const g of groups) {
    total += g._count._all;
    map.set(g.courseId, g._count._all);
  }
  return { map, total };
}

// ——— публичный вход ————————————————————————————————————————————————

/** Самое раннее событие — для пресета «всё время». */
export async function earliestEventDate(): Promise<Date | null> {
  const row = await db.event.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  return row?.createdAt ?? null;
}

export async function getDashboard(fromRaw: Date, toRaw: Date, compare: boolean): Promise<Dashboard> {
  const from = startOfDay(fromRaw);
  const to = endOfDay(toRaw);
  const days = differenceInCalendarDays(to, from) + 1;

  // Предыдущий период такой же длины, встык слева.
  const prevTo = subMilliseconds(from, 1);
  const prevFrom = startOfDay(subMilliseconds(from, days * 24 * 60 * 60 * 1000));

  const [
    curTotals,
    prevTotals,
    curDaily,
    prevDaily,
    countries,
    pages,
    sources,
    courseViews,
    curLeads,
    prevLeads,
    curEnroll,
    prevEnroll,
    publishedCourses,
    leadsDaily,
    enrollDaily,
  ] = await Promise.all([
    totals(from, to),
    compare ? totals(prevFrom, prevTo) : Promise.resolve<Totals>({ views: 0, visitors: 0 }),
    dailySeries(from, to),
    compare ? dailySeries(prevFrom, prevTo) : Promise.resolve(new Map<string, Totals>()),
    countByMeta(from, to, "country", 12),
    countByMeta(from, to, "path", 10),
    countByMeta(from, to, "ref", 8),
    countByMeta(from, to, "slug", 100),
    leadsByCourse(from, to),
    compare ? leadsByCourse(prevFrom, prevTo) : Promise.resolve({ map: new Map<string, number>(), total: 0 }),
    enrollmentsByCourse(from, to),
    compare ? enrollmentsByCourse(prevFrom, prevTo) : Promise.resolve({ map: new Map<string, number>(), total: 0 }),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, slug: true, title: true },
    }),
    dailyCount("Lead", "createdAt", from, to),
    dailyCount("Enrollment", "startsAt", from, to),
  ]);

  // Временной ряд: полный список дней с нулями, наложение предыдущего по индексу.
  const curDays = eachDayOfInterval({ start: from, end: to });
  const prevDays = compare ? eachDayOfInterval({ start: prevFrom, end: prevTo }) : [];
  const timeseries: TimePoint[] = curDays.map((d, i) => {
    const cur = curDaily.get(dayKey(d)) ?? { views: 0, visitors: 0 };
    const prevDate = prevDays[i];
    const prev = prevDate ? (prevDaily.get(dayKey(prevDate)) ?? { views: 0, visitors: 0 }) : null;
    return {
      date: dayKey(d),
      views: cur.views,
      visitors: cur.visitors,
      prevViews: prev ? prev.views : null,
      prevVisitors: prev ? prev.visitors : null,
    };
  });

  // Популярность курсов: просмотры (по slug) + заявки/записи (по id).
  const viewsBySlug = new Map(courseViews.map((c) => [c.key, c]));
  const courses: CoursePopularity[] = publishedCourses
    .map((c) => {
      const v = viewsBySlug.get(c.slug);
      const views = v?.value ?? 0;
      const enrollments = curEnroll.map.get(c.id) ?? 0;
      return {
        slug: c.slug,
        title: c.title,
        views,
        visitors: v?.visitors ?? 0,
        leads: curLeads.map.get(c.id) ?? 0,
        enrollments,
        conversion: views > 0 ? round1((enrollments / views) * 100) : 0,
      };
    })
    .sort((a, b) => b.views - a.views || b.leads - a.leads || b.enrollments - a.enrollments);

  const courseViewTotal = courseViews.reduce((s, c) => s + c.value, 0);

  // Спарклайны по дням текущего периода (выровнены с timeseries).
  const sparks: Sparks = {
    visitors: timeseries.map((p) => p.visitors),
    views: timeseries.map((p) => p.views),
    leads: curDays.map((d) => leadsDaily.get(dayKey(d)) ?? 0),
    enrollments: curDays.map((d) => enrollDaily.get(dayKey(d)) ?? 0),
    conversion: timeseries.map((p, i) => {
      const l = leadsDaily.get(dayKey(curDays[i]!)) ?? 0;
      return p.visitors > 0 ? round1((l / p.visitors) * 100) : 0;
    }),
  };

  return {
    range: { from: dayKey(from), to: dayKey(to), days, compare },
    kpis: {
      visitors: metric(curTotals.visitors, compare ? prevTotals.visitors : null),
      views: metric(curTotals.views, compare ? prevTotals.views : null),
      leads: metric(curLeads.total, compare ? prevLeads.total : null),
      enrollments: metric(curEnroll.total, compare ? prevEnroll.total : null),
      conversion: metric(
        rate(curLeads.total, curTotals.visitors),
        compare ? rate(prevLeads.total, prevTotals.visitors) : null,
      ),
    },
    sparks,
    timeseries,
    courses,
    countries: countries.map((c) => ({ key: c.key, label: c.key, value: c.value, visitors: c.visitors })),
    pages: pages.map((p) => ({ key: p.key, label: p.key, value: p.value, visitors: p.visitors })),
    sources: sources.map((s) => ({ key: s.key, label: s.key, value: s.value, visitors: s.visitors })),
    funnel: {
      views: curTotals.views,
      courseViews: courseViewTotal,
      leads: curLeads.total,
      enrollments: curEnroll.total,
    },
  };
}

// ——— утилиты ————————————————————————————————————————————————————————

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Доля a/b в процентах (0, если знаменатель нулевой). */
function rate(a: number, b: number): number {
  return b > 0 ? round1((a / b) * 100) : 0;
}

function metric(value: number, prev: number | null): Metric {
  if (prev === null) return { value, prev: null, deltaPct: null };
  const deltaPct = prev > 0 ? round1(((value - prev) / prev) * 100) : value > 0 ? 100 : 0;
  return { value, prev, deltaPct };
}
