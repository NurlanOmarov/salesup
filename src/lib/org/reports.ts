import type { OrgRole } from "@prisma/client";
import { db } from "@/lib/db";
import { computeSeatUsage, type SeatUsage } from "@/lib/org/seats";

/**
 * Отчётность кабинета организации и админ-консоли владельца (оферта /offer-b2b, п. 8):
 * доля пройденных уроков, результаты тестов, сертификаты, активность за период —
 * в разрезе условных обозначений и подразделений.
 *
 * ПДн здесь нет по построению: наружу отдаются только login работника
 * (acme-0042), зашифрованная метка и агрегаты. Расшифровка метки — в браузере.
 */

export interface LicenseSummary {
  id: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  seats: SeatUsage;
  startsAt: Date;
  expiresAt: Date | null;
  accessDuration: string;
  priceTiyn: number | null;
}

/** Лицензии организации с реальной занятостью мест. */
export async function getOrgLicenses(orgId: string): Promise<LicenseSummary[]> {
  const licenses = await db.orgLicense.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      courseId: true,
      seatsTotal: true,
      startsAt: true,
      expiresAt: true,
      accessDuration: true,
      priceTiyn: true,
      course: { select: { title: true, slug: true } },
      _count: { select: { enrollments: { where: { revokedAt: null } } } },
    },
  });

  return licenses.map((l) => ({
    id: l.id,
    courseId: l.courseId,
    courseTitle: l.course.title,
    courseSlug: l.course.slug,
    seats: computeSeatUsage({
      seatsTotal: l.seatsTotal,
      activeEnrollments: l._count.enrollments,
    }),
    startsAt: l.startsAt,
    expiresAt: l.expiresAt,
    accessDuration: l.accessDuration,
    priceTiyn: l.priceTiyn,
  }));
}

export interface OrgListRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string | null;
  members: number;
  admins: number;
  seatsTotal: number;
  seatsUsed: number;
  licenses: number;
  /** Ближайшее окончание лицензии — по нему видно, кому пора продлевать. */
  nextExpiryAt: Date | null;
  createdAt: Date;
}

/**
 * Список организаций для консоли владельца. Считает занятость мест одним
 * groupBy вместо запроса на каждую организацию.
 */
export async function getOrgsList(): Promise<OrgListRow[]> {
  const orgs = await db.organization.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      contactEmail: true,
      createdAt: true,
      memberships: { select: { role: true, isActive: true } },
      licenses: { select: { id: true, seatsTotal: true, expiresAt: true } },
    },
  });
  if (orgs.length === 0) return [];

  const licenseIds = orgs.flatMap((o) => o.licenses.map((l) => l.id));
  const usedByLicense = new Map<string, number>();
  if (licenseIds.length > 0) {
    const grouped = await db.enrollment.groupBy({
      by: ["licenseId"],
      where: { licenseId: { in: licenseIds }, revokedAt: null },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (g.licenseId) usedByLicense.set(g.licenseId, g._count._all);
    }
  }

  return orgs.map((o) => {
    const expiries = o.licenses
      .map((l) => l.expiresAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      status: o.status,
      contactEmail: o.contactEmail,
      members: o.memberships.filter((m) => m.isActive && m.role === "ORG_LEARNER").length,
      admins: o.memberships.filter((m) => m.isActive && m.role === "ORG_ADMIN").length,
      seatsTotal: o.licenses.reduce((s, l) => s + l.seatsTotal, 0),
      seatsUsed: o.licenses.reduce((s, l) => s + (usedByLicense.get(l.id) ?? 0), 0),
      licenses: o.licenses.length,
      nextExpiryAt: expiries[0] ?? null,
      createdAt: o.createdAt,
    };
  });
}

export interface MemberRow {
  membershipId: string;
  userId: string;
  /** Условное обозначение работника: acme-0042. Единственный открытый идентификатор. */
  login: string;
  /** Метка клиента, зашифрованная в браузере. Сервер её не читает. */
  labelEnc: string | null;
  role: OrgRole;
  groupName: string | null;
  isActive: boolean;
  joinedAt: Date;
  /** Сколько курсов открыто (мест занято этим работником). */
  courses: number;
  /** Доля пройденных уроков 0..1 по всем открытым курсам. */
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  /** Средний балл сданных тестов, % (null — ни одного сданного). */
  avgScore: number | null;
  certificates: number;
  lastActiveAt: Date | null;
  /** Ни одного просмотренного урока — «не приступал». */
  notStarted: boolean;
}

/**
 * Работники организации с агрегатами обучения.
 *
 * Считаем в несколько плоских запросов вместо N+1: сначала членства и места,
 * затем один проход по урокам курсов организации, затем groupBy по прогрессу,
 * попыткам и сертификатам. Для типового клиента (десятки-сотни работников,
 * единицы курсов) это укладывается в один экран без пагинации по БД.
 */
export async function getOrgMembers(orgId: string): Promise<MemberRow[]> {
  const memberships = await db.orgMembership.findMany({
    where: { orgId },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      userId: true,
      role: true,
      labelEnc: true,
      isActive: true,
      joinedAt: true,
      group: { select: { name: true } },
      user: { select: { login: true, email: true } },
    },
  });
  if (memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.userId);

  // Места: какие курсы открыты каждому работнику (не отозванные).
  const enrollments = await db.enrollment.findMany({
    where: { userId: { in: userIds }, revokedAt: null },
    select: { userId: true, courseId: true },
  });

  const courseIds = [...new Set(enrollments.map((e) => e.courseId))];

  // Опубликованные уроки этих курсов — знаменатель прогресса.
  const lessons = courseIds.length
    ? await db.lesson.findMany({
        where: {
          status: "PUBLISHED",
          module: { courseId: { in: courseIds } },
        },
        select: { id: true, module: { select: { courseId: true } } },
      })
    : [];

  const lessonsByCourse = new Map<string, string[]>();
  for (const l of lessons) {
    const list = lessonsByCourse.get(l.module.courseId) ?? [];
    list.push(l.id);
    lessonsByCourse.set(l.module.courseId, list);
  }

  const coursesByUser = new Map<string, string[]>();
  for (const e of enrollments) {
    const list = coursesByUser.get(e.userId) ?? [];
    list.push(e.courseId);
    coursesByUser.set(e.userId, list);
  }

  const lessonIds = lessons.map((l) => l.id);

  // Пройденные уроки и последняя активность.
  const progressRows = lessonIds.length
    ? await db.lessonProgress.findMany({
        where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
        select: {
          userId: true,
          lessonId: true,
          completedAt: true,
          updatedAt: true,
        },
      })
    : [];

  const doneByUser = new Map<string, Set<string>>();
  const touchedByUser = new Map<string, number>();
  const lastActiveByUser = new Map<string, Date>();
  for (const p of progressRows) {
    if (p.completedAt) {
      const set = doneByUser.get(p.userId) ?? new Set<string>();
      set.add(p.lessonId);
      doneByUser.set(p.userId, set);
    }
    touchedByUser.set(p.userId, (touchedByUser.get(p.userId) ?? 0) + 1);
    const prev = lastActiveByUser.get(p.userId);
    if (!prev || p.updatedAt.getTime() > prev.getTime()) {
      lastActiveByUser.set(p.userId, p.updatedAt);
    }
  }

  // Средний балл: только сданные попытки — «сколько знает», а не «сколько раз пробовал».
  const attempts = await db.quizAttempt.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: "PASSED", scorePct: { not: null } },
    _avg: { scorePct: true },
  });
  const avgByUser = new Map(attempts.map((a) => [a.userId, a._avg.scorePct]));

  const certs = await db.certificate.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, revokedAt: null },
    _count: { _all: true },
  });
  const certsByUser = new Map(certs.map((c) => [c.userId, c._count._all]));

  return memberships.map((m) => {
    const userCourses = coursesByUser.get(m.userId) ?? [];
    const total = userCourses.reduce(
      (sum, courseId) => sum + (lessonsByCourse.get(courseId)?.length ?? 0),
      0,
    );
    const doneSet = doneByUser.get(m.userId);
    // Считаем только уроки открытых работнику курсов: место могли отозвать,
    // а прогресс по нему остался — он не должен раздувать знаменатель.
    const allowed = new Set(
      userCourses.flatMap((courseId) => lessonsByCourse.get(courseId) ?? []),
    );
    const done = doneSet ? [...doneSet].filter((id) => allowed.has(id)).length : 0;
    const avg = avgByUser.get(m.userId);

    return {
      membershipId: m.id,
      userId: m.userId,
      login: m.user.login ?? m.user.email ?? "—",
      labelEnc: m.labelEnc,
      role: m.role,
      groupName: m.group?.name ?? null,
      isActive: m.isActive,
      joinedAt: m.joinedAt,
      courses: userCourses.length,
      progress: total === 0 ? 0 : done / total,
      lessonsDone: done,
      lessonsTotal: total,
      avgScore: avg == null ? null : Math.round(avg),
      certificates: certsByUser.get(m.userId) ?? 0,
      lastActiveAt: lastActiveByUser.get(m.userId) ?? null,
      notStarted: (touchedByUser.get(m.userId) ?? 0) === 0,
    };
  });
}

export interface CourseProgressRow {
  courseId: string;
  courseTitle: string;
  /** Сколько работников имеют действующее место на курсе. */
  learners: number;
  /** Полностью прошли все опубликованные уроки курса. */
  completed: number;
  /** Не открывали ни одного урока. */
  notStarted: number;
  avgProgress: number;
  avgScore: number | null;
  certificates: number;
}

/**
 * Разрез отчётности по курсам (оферта /offer-b2b, п. 8.1). Отвечает на вопрос
 * «какой курс реально проходят, а какой куплен и стоит» — по нему решают, что
 * продлевать.
 */
export async function getOrgCourseProgress(
  orgId: string,
): Promise<CourseProgressRow[]> {
  const licenses = await db.orgLicense.findMany({
    where: { orgId },
    select: { courseId: true, course: { select: { title: true } } },
  });
  if (licenses.length === 0) return [];

  const courseIds = licenses.map((l) => l.courseId);

  const [enrollments, lessons, memberships] = await Promise.all([
    db.enrollment.findMany({
      where: { license: { orgId }, revokedAt: null, courseId: { in: courseIds } },
      select: { userId: true, courseId: true },
    }),
    db.lesson.findMany({
      where: { status: "PUBLISHED", module: { courseId: { in: courseIds } } },
      select: { id: true, module: { select: { courseId: true } } },
    }),
    db.orgMembership.findMany({ where: { orgId }, select: { userId: true } }),
  ]);

  const userIds = memberships.map((m) => m.userId);
  const lessonIds = lessons.map((l) => l.id);

  const [progress, attempts, certs] = await Promise.all([
    lessonIds.length
      ? db.lessonProgress.findMany({
          where: {
            userId: { in: userIds },
            lessonId: { in: lessonIds },
          },
          select: { userId: true, lessonId: true, completedAt: true },
        })
      : [],
    db.quizAttempt.findMany({
      where: {
        userId: { in: userIds },
        status: "PASSED",
        scorePct: { not: null },
        quiz: { OR: [{ courseId: { in: courseIds } }, { lesson: { module: { courseId: { in: courseIds } } } }] },
      },
      select: {
        userId: true,
        scorePct: true,
        quiz: {
          select: {
            courseId: true,
            lesson: { select: { module: { select: { courseId: true } } } },
          },
        },
      },
    }),
    db.certificate.groupBy({
      by: ["courseId"],
      where: { userId: { in: userIds }, courseId: { in: courseIds }, revokedAt: null },
      _count: { _all: true },
    }),
  ]);

  const lessonsByCourse = new Map<string, Set<string>>();
  for (const l of lessons) {
    const set = lessonsByCourse.get(l.module.courseId) ?? new Set<string>();
    set.add(l.id);
    lessonsByCourse.set(l.module.courseId, set);
  }

  const certsByCourse = new Map(certs.map((c) => [c.courseId, c._count._all]));

  return licenses.map((l) => {
    const courseLessons = lessonsByCourse.get(l.courseId) ?? new Set<string>();
    const learners = enrollments.filter((e) => e.courseId === l.courseId);

    let sumProgress = 0;
    let completed = 0;
    let notStarted = 0;

    for (const e of learners) {
      const own = progress.filter(
        (p) => p.userId === e.userId && courseLessons.has(p.lessonId),
      );
      const done = own.filter((p) => p.completedAt).length;
      const ratio = courseLessons.size === 0 ? 0 : done / courseLessons.size;
      sumProgress += ratio;
      if (courseLessons.size > 0 && done === courseLessons.size) completed += 1;
      if (own.length === 0) notStarted += 1;
    }

    const courseAttempts = attempts.filter((a) => {
      const cid = a.quiz.courseId ?? a.quiz.lesson?.module.courseId;
      return cid === l.courseId;
    });
    const avgScore =
      courseAttempts.length === 0
        ? null
        : Math.round(
            courseAttempts.reduce((s, a) => s + (a.scorePct ?? 0), 0) /
              courseAttempts.length,
          );

    return {
      courseId: l.courseId,
      courseTitle: l.course.title,
      learners: learners.length,
      completed,
      notStarted,
      avgProgress: learners.length === 0 ? 0 : sumProgress / learners.length,
      avgScore,
      certificates: certsByCourse.get(l.courseId) ?? 0,
    };
  });
}

export interface OrgOverview {
  members: number;
  activeMembers: number;
  notStarted: number;
  activeLast7d: number;
  avgProgress: number;
  certificates: number;
  licenses: LicenseSummary[];
  seatsTotal: number;
  seatsUsed: number;
}

/** Сводка для дашборда организации и карточки клиента в консоли владельца. */
export async function getOrgOverview(orgId: string): Promise<OrgOverview> {
  const [licenses, members] = await Promise.all([
    getOrgLicenses(orgId),
    getOrgMembers(orgId),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const learners = members.filter((m) => m.isActive);
  const withProgress = learners.filter((m) => m.lessonsTotal > 0);

  return {
    members: members.length,
    activeMembers: learners.length,
    notStarted: learners.filter((m) => m.notStarted).length,
    activeLast7d: learners.filter(
      (m) => m.lastActiveAt && m.lastActiveAt.getTime() >= weekAgo.getTime(),
    ).length,
    avgProgress:
      withProgress.length === 0
        ? 0
        : withProgress.reduce((s, m) => s + m.progress, 0) / withProgress.length,
    certificates: members.reduce((s, m) => s + m.certificates, 0),
    licenses,
    seatsTotal: licenses.reduce((s, l) => s + l.seats.total, 0),
    seatsUsed: licenses.reduce((s, l) => s + l.seats.used, 0),
  };
}
