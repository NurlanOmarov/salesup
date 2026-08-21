import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { requireOrgAdmin } from "@/lib/org/guards";
import {
  getOrgCourseProgress,
  getOrgLicenses,
  getOrgMembers,
} from "@/lib/org/reports";
import { ProgressBar, relativeDays } from "@/app/(owner)/admin/orgs/org-ui";
import { ReportExport } from "./report-export";

export const metadata: Metadata = {
  title: "Отчёты",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Отчётность по обучению (оферта /offer-b2b, п. 8): доля пройденных уроков,
 * результаты тестов, сертификаты и активность — в разрезе условных обозначений,
 * подразделений и курсов. Выгрузка в XLSX собирается в браузере, чтобы имена
 * сотрудников не проходили через сервер (L2).
 */
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await requireOrgAdmin(orgId);

  const [members, byCourse, licenses] = await Promise.all([
    getOrgMembers(ctx.orgId),
    getOrgCourseProgress(ctx.orgId),
    getOrgLicenses(ctx.orgId),
  ]);

  const learners = members.filter((m) => m.role === "ORG_LEARNER");
  const seatsByCourse = new Map(licenses.map((l) => [l.courseId, l]));

  // Сводка по подразделениям: считается из тех же строк, что и таблица.
  const groups = new Map<string, { count: number; progress: number; started: number }>();
  for (const m of learners) {
    const key = m.groupName ?? "Без подразделения";
    const g = groups.get(key) ?? { count: 0, progress: 0, started: 0 };
    g.count += 1;
    g.progress += m.progress;
    if (!m.notStarted) g.started += 1;
    groups.set(key, g);
  }

  const exportMembers = learners.map((m) => ({
    login: m.login,
    labelEnc: m.labelEnc,
    group: m.groupName,
    courses: m.courses,
    lessonsDone: m.lessonsDone,
    lessonsTotal: m.lessonsTotal,
    progressPct: Math.round(m.progress * 100),
    avgScore: m.avgScore,
    certificates: m.certificates,
    lastActive: m.lastActiveAt
      ? m.lastActiveAt.toLocaleDateString("ru-RU")
      : "не заходил",
    status: !m.isActive ? "отключён" : m.notStarted ? "не начинал" : "учится",
  }));

  const exportCourses = byCourse.map((c) => {
    const license = seatsByCourse.get(c.courseId);
    return {
      courseTitle: c.courseTitle,
      learners: c.learners,
      completed: c.completed,
      notStarted: c.notStarted,
      avgProgressPct: Math.round(c.avgProgress * 100),
      avgScore: c.avgScore,
      certificates: c.certificates,
      seatsUsed: license?.seats.used ?? 0,
      seatsTotal: license?.seats.total ?? 0,
      expiresAt: license?.expiresAt
        ? license.expiresAt.toLocaleDateString("ru-RU")
        : "бессрочно",
    };
  });

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Отчёты</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Данные считаются автоматически по мере занятий сотрудников.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-foreground/10 bg-background p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FileSpreadsheet className="size-4 text-emerald-700" />
          Выгрузка для HR
        </p>
        <p className="mt-1 text-sm text-foreground/60">
          Excel-файл с двумя листами: по сотрудникам и по курсам.
        </p>
        <div className="mt-3">
          <ReportExport
            orgName={ctx.orgName}
            members={exportMembers}
            courses={exportCourses}
          />
        </div>
      </div>

      {/* ── По курсам ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">По курсам</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
          {byCourse.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/55">
              Пока нет лицензий, по которым можно построить отчёт.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Курс</th>
                  <th className="px-4 py-3 font-medium">Учатся</th>
                  <th className="px-4 py-3 font-medium">Прошли</th>
                  <th className="px-4 py-3 font-medium">Не начинали</th>
                  <th className="px-4 py-3 font-medium">Средний прогресс</th>
                  <th className="px-4 py-3 font-medium">Балл</th>
                  <th className="px-4 py-3 font-medium">Сертификаты</th>
                </tr>
              </thead>
              <tbody>
                {byCourse.map((c) => (
                  <tr key={c.courseId} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{c.courseTitle}</td>
                    <td className="px-4 py-3 text-foreground/70">{c.learners}</td>
                    <td className="px-4 py-3 text-foreground/70">{c.completed}</td>
                    <td className="px-4 py-3">
                      {c.notStarted > 0 ? (
                        <span className="text-amber-700">{c.notStarted}</span>
                      ) : (
                        <span className="text-foreground/70">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ProgressBar value={c.avgProgress} />
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {c.avgScore == null ? "—" : `${c.avgScore}%`}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{c.certificates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── По подразделениям ─────────────────────────────────────── */}
      {groups.size > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">По подразделениям</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10 bg-background">
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Подразделение</th>
                  <th className="px-4 py-3 font-medium">Сотрудников</th>
                  <th className="px-4 py-3 font-medium">Приступили</th>
                  <th className="px-4 py-3 font-medium">Средний прогресс</th>
                </tr>
              </thead>
              <tbody>
                {[...groups.entries()].map(([name, g]) => (
                  <tr key={name} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3 text-foreground/70">{g.count}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {g.started} из {g.count}
                    </td>
                    <td className="px-4 py-3">
                      <ProgressBar value={g.count === 0 ? 0 : g.progress / g.count} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Сотрудники ────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Сотрудники</h2>
        <p className="mt-1 text-sm text-foreground/55">
          Подписи видны на вкладке «Работники» после ввода ПИН-кода; здесь —
          сводка по кодам.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
          {learners.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/55">
              Работников пока нет.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Код</th>
                  <th className="px-4 py-3 font-medium">Подразделение</th>
                  <th className="px-4 py-3 font-medium">Прогресс</th>
                  <th className="px-4 py-3 font-medium">Балл</th>
                  <th className="px-4 py-3 font-medium">Сертификаты</th>
                  <th className="px-4 py-3 font-medium">Активность</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((m) => (
                  <tr key={m.membershipId} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 font-mono">{m.login}</td>
                    <td className="px-4 py-3 text-foreground/70">{m.groupName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ProgressBar value={m.progress} />
                      <span className="text-xs text-foreground/45">
                        {m.lessonsDone} из {m.lessonsTotal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {m.avgScore == null ? "—" : `${m.avgScore}%`}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{m.certificates}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {relativeDays(m.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
