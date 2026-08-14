import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getOrgMembers, getOrgOverview } from "@/lib/org/reports";
import { ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { OrgStatusBadge, ProgressBar, relativeDays, SeatsBar } from "../org-ui";
import {
  LicenseForm,
  OrgAdminForm,
  OrgDetailsForm,
  OrgStatusActions,
} from "./org-manage";

export const metadata: Metadata = {
  title: "Организация",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Карточка корпоративного клиента — рабочее место владельца по одной организации.
 *
 * Порядок блоков = порядок работы: сначала видно состояние (места, активность),
 * потом продающие действия (лицензии), потом разовая настройка (ответственный),
 * потом наблюдение (работники, журнал). Персональных данных работников здесь нет
 * и быть не может: только условные обозначения вида acme-0042.
 */
export default async function OrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      unp: true,
      status: true,
      contactEmail: true,
      contactNote: true,
      note: true,
      createdAt: true,
      loginSeq: true,
    },
  });
  if (!org) notFound();

  const [overview, members, courses, admins, logs] = await Promise.all([
    getOrgOverview(org.id),
    getOrgMembers(org.id),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, priceTiyn: true },
    }),
    db.orgMembership.findMany({
      where: { orgId: org.id, role: "ORG_ADMIN" },
      select: {
        id: true,
        isActive: true,
        user: { select: { id: true, email: true, name: true, mustChangePassword: true } },
      },
    }),
    db.adminLog.findMany({
      where: { meta: { path: ["orgId"], equals: org.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true, meta: true },
    }),
  ]);

  const learners = members.filter((m) => m.role === "ORG_LEARNER");

  return (
    <main>
      <Link
        href="/admin/orgs"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />К организациям
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <OrgStatusBadge status={org.status} />
          </div>
          <p className="mt-1 text-sm text-foreground/55">
            Код <span className="font-mono text-foreground/80">{org.slug}</span>
            {org.unp ? ` · УНП ${org.unp}` : ""} · заведена{" "}
            {org.createdAt.toLocaleDateString("ru-RU")} · выдано логинов:{" "}
            {org.loginSeq}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/org/${org.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            <ExternalLink className="size-4" />
            Открыть кабинет клиента
          </Link>
          <OrgStatusActions orgId={org.id} status={org.status} />
        </div>
      </div>

      {org.status === "SUSPENDED" ? (
        <p className="mt-4 rounded-xl border border-amber-600/30 bg-amber-500/5 p-3 text-sm text-amber-800">
          Доступ приостановлен: работники не могут открыть уроки. Прогресс сохранён —
          при возобновлении доступы вернутся автоматически.
        </p>
      ) : null}

      {/* ── Состояние ────────────────────────────────────────────────── */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Мест занято"
          value={`${overview.seatsUsed} / ${overview.seatsTotal}`}
          hint={
            overview.seatsTotal > overview.seatsUsed
              ? `${overview.seatsTotal - overview.seatsUsed} свободно`
              : "все места заняты"
          }
        />
        <Card
          label="Учатся за 7 дней"
          value={String(overview.activeLast7d)}
          hint={`из ${overview.activeMembers} работников`}
        />
        <Card
          label="Средний прогресс"
          value={`${Math.round(overview.avgProgress * 100)}%`}
          hint={overview.notStarted > 0 ? `${overview.notStarted} не приступали` : "все начали"}
        />
        <Card label="Сертификатов" value={String(overview.certificates)} />
      </section>

      {/* ── Лицензии ─────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Лицензии</h2>
        <p className="mt-1 text-sm text-foreground/55">
          Единица лицензии — курс × человек: работник, которому открыли три курса,
          занимает по одному месту в трёх лицензиях.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {overview.licenses.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/50">
              Лицензий пока нет. Выдайте первую — без неё работникам нечего открывать.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Курс</th>
                  <th className="px-4 py-3 font-medium">Места</th>
                  <th className="px-4 py-3 font-medium">Срок места</th>
                  <th className="px-4 py-3 font-medium">Лицензия до</th>
                </tr>
              </thead>
              <tbody>
                {overview.licenses.map((l) => (
                  <tr key={l.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 font-medium">{l.courseTitle}</td>
                    <td className="px-4 py-3">
                      <SeatsBar used={l.seats.used} total={l.seats.total} />
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {ACCESS_DURATION_LABELS[
                        l.accessDuration as keyof typeof ACCESS_DURATION_LABELS
                      ] ?? l.accessDuration}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {l.expiresAt ? l.expiresAt.toLocaleDateString("ru-RU") : "бессрочно"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-foreground/10 bg-background p-4">
          <h3 className="text-sm font-semibold">Выдать или изменить лицензию</h3>
          <div className="mt-3">
            <LicenseForm
              orgId={org.id}
              courses={courses}
              existing={overview.licenses.map((l) => ({
                courseId: l.courseId,
                seatsTotal: l.seats.total,
                accessDuration: l.accessDuration,
              }))}
            />
          </div>
        </div>
      </section>

      {/* ── Ответственные представители ──────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Ответственные представители</h2>
        <p className="mt-1 text-sm text-foreground/55">
          Управляют кабинетом организации: заводят работников, раздают коды, смотрят
          отчёты. Это единственные люди клиента, чьи контакты мы храним.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {admins.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/50">
              Ответственный не назначен — кабинетом пока некому пользоваться.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{a.user.name ?? a.user.email}</p>
                    <p className="text-xs text-foreground/50">{a.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.user.mustChangePassword ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                        ждёт первого входа
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                        активен
                      </span>
                    )}
                    {!a.isActive ? (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                        отключён
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-foreground/10 bg-background p-4">
          <h3 className="text-sm font-semibold">Назначить ответственного</h3>
          <div className="mt-3">
            <OrgAdminForm orgId={org.id} />
          </div>
        </div>
      </section>

      {/* ── Работники ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Работники</h2>
          <p className="inline-flex items-center gap-1.5 text-xs text-foreground/50">
            <ShieldCheck className="size-3.5" />
            только условные обозначения — ФИО платформа не получает
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {learners.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/50">
              Работников пока нет. Ответственный представитель создаст коды
              самозаписи в своём кабинете и раздаст их сотрудникам.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Код</th>
                  <th className="px-4 py-3 font-medium">Подразделение</th>
                  <th className="px-4 py-3 font-medium">Курсов</th>
                  <th className="px-4 py-3 font-medium">Прогресс</th>
                  <th className="px-4 py-3 font-medium">Балл</th>
                  <th className="px-4 py-3 font-medium">Активность</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((m) => (
                  <tr
                    key={m.membershipId}
                    className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/students/${m.userId}`}
                        className="font-mono text-amber-700 hover:underline"
                      >
                        {m.login}
                      </Link>
                      {!m.isActive ? (
                        <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground/60">
                          отключён
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{m.groupName ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground/70">{m.courses}</td>
                    <td className="px-4 py-3">
                      <ProgressBar value={m.progress} />
                      <span className="text-xs text-foreground/45">
                        {m.lessonsDone} из {m.lessonsTotal} уроков
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {m.avgScore == null ? "—" : `${m.avgScore}%`}
                    </td>
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

      {/* ── Реквизиты ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Реквизиты и заметки</h2>
        <div className="mt-4 rounded-xl border border-foreground/10 bg-background p-4">
          <OrgDetailsForm org={org} />
        </div>
      </section>

      {/* ── Журнал ───────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Журнал действий</h2>
        <p className="mt-1 text-sm text-foreground/55">
          Требование Приложения 1 к оферте для организаций: действия администратора
          фиксируются.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {logs.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/50">Пока пусто.</p>
          ) : (
            <ul className="divide-y divide-foreground/5 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <span className="font-mono text-xs text-foreground/70">{l.action}</span>
                  <span className="shrink-0 text-xs text-foreground/45">
                    {l.createdAt.toLocaleString("ru-RU")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-foreground/50">{hint}</p> : null}
    </div>
  );
}
