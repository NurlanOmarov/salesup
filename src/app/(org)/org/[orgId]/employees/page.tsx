import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgAdmin } from "@/lib/org/guards";
import { getOrgLicenses, getOrgMembers } from "@/lib/org/reports";
import { db } from "@/lib/db";
import { ProgressBar, relativeDays } from "@/app/(owner)/admin/orgs/org-ui";
import { EmployeeActions, type SeatInfo } from "./employee-row";
import { MemberLabel } from "./member-label";
import { CreateMembers } from "./create-members";
import { OrgKeyBar } from "../org-key-bar";

export const metadata: Metadata = {
  title: "Работники",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Работники организации: прогресс по каждому + управление местами.
 * Идентификатор — только условное обозначение (acme-0042); соответствие людям
 * ведёт клиент у себя (оферта /offer-b2b, п. 10.2).
 */
export default async function EmployeesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await requireOrgAdmin(orgId);

  const [members, licenses, groups, enrollments] = await Promise.all([
    getOrgMembers(ctx.orgId),
    getOrgLicenses(ctx.orgId),
    db.orgGroup.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.enrollment.findMany({
      where: { license: { orgId: ctx.orgId }, revokedAt: null },
      select: {
        id: true,
        userId: true,
        licenseId: true,
        expiresAt: true,
        course: { select: { title: true } },
      },
    }),
  ]);

  const learners = members.filter((m) => m.role === "ORG_LEARNER");
  const seatsByUser = new Map<string, SeatInfo[]>();
  for (const e of enrollments) {
    if (!e.licenseId) continue;
    const list = seatsByUser.get(e.userId) ?? [];
    list.push({
      enrollmentId: e.id,
      licenseId: e.licenseId,
      courseTitle: e.course.title,
      expiresAt: e.expiresAt ? e.expiresAt.toLocaleDateString("ru-RU") : null,
    });
    seatsByUser.set(e.userId, list);
  }

  const licenseOptions = licenses.map((l) => ({
    id: l.id,
    courseTitle: l.courseTitle,
    free: l.seats.free,
  }));

  // Соответствие membershipId → groupId для формы (getOrgMembers отдаёт название).
  const groupIdByMembership = new Map(
    (
      await db.orgMembership.findMany({
        where: { orgId: ctx.orgId },
        select: { id: true, groupId: true },
      })
    ).map((m) => [m.id, m.groupId]),
  );

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Работники</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {learners.length > 0
              ? `${learners.length} в организации`
              : "Пока никто не зарегистрировался"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateMembers
            orgId={ctx.orgId}
            licenses={licenseOptions}
            groups={groups}
          />
          <Link
            href={`/org/${ctx.orgId}/invites`}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            + Коды доступа
          </Link>
        </div>
      </div>

      {/* Управление подписями сотрудников: включение шифрования / ввод фразы.
          Стоит здесь, а не в настройках, — подписи нужны именно в этой таблице. */}
      <div className="mt-5">
        <OrgKeyBar />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-foreground/10 bg-background">
        {learners.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">Работников пока нет</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-foreground/55">
              Создайте коды доступа и раздайте их сотрудникам: каждый введёт свой код
              на странице регистрации, придумает пароль и сразу начнёт обучение.
            </p>
            <p className="mt-1 text-sm text-foreground/55">
              Либо создайте учётные записи сами — получите список логинов и
              временных паролей.
            </p>
            <Link
              href={`/org/${ctx.orgId}/invites`}
              className="mt-4 inline-block rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              Создать коды
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Код</th>
                <th className="px-4 py-3 font-medium">Подразделение</th>
                <th className="px-4 py-3 font-medium">Курсы</th>
                <th className="px-4 py-3 font-medium">Прогресс</th>
                <th className="px-4 py-3 font-medium">Балл</th>
                <th className="px-4 py-3 font-medium">Активность</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {learners.map((m) => (
                <tr
                  key={m.membershipId}
                  className="border-b border-foreground/5 align-top last:border-0"
                >
                  <td className="group px-4 py-3">
                    <span className="font-mono">{m.login}</span>
                    {!m.isActive ? (
                      <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground/60">
                        отключён
                      </span>
                    ) : null}
                    {m.notStarted && m.isActive ? (
                      <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700">
                        не начинал
                      </span>
                    ) : null}
                    <MemberLabel
                      orgId={ctx.orgId}
                      membershipId={m.membershipId}
                      labelEnc={m.labelEnc}
                    />
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{m.groupName ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground/70">{m.courses}</td>
                  <td className="px-4 py-3">
                    <ProgressBar value={m.progress} />
                    <span className="text-xs text-foreground/45">
                      {m.lessonsDone} из {m.lessonsTotal}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {m.avgScore == null ? "—" : `${m.avgScore}%`}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {relativeDays(m.lastActiveAt)}
                  </td>
                  <td className="px-4 py-3">
                    <EmployeeActions
                      orgId={ctx.orgId}
                      data={{
                        membershipId: m.membershipId,
                        login: m.login,
                        groupId: groupIdByMembership.get(m.membershipId) ?? null,
                        isActive: m.isActive,
                        seats: seatsByUser.get(m.userId) ?? [],
                      }}
                      licenses={licenseOptions}
                      groups={groups}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
