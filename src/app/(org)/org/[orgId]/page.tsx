import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { requireOrgAdmin } from "@/lib/org/guards";
import { getOrgOverview } from "@/lib/org/reports";
import { SeatsBar } from "@/app/(owner)/admin/orgs/org-ui";
import { LiveSessionsBlock } from "@/components/live/sessions-block";

export const metadata: Metadata = {
  title: "Обзор обучения",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Дашборд организации. Отвечает на три вопроса ответственного за обучение:
 * сколько мест не использовано, кто вообще не начинал и как идут дела в целом.
 * Всё остальное — на вкладках.
 */
export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await requireOrgAdmin(orgId);
  const overview = await getOrgOverview(ctx.orgId);

  const freeSeats = overview.seatsTotal - overview.seatsUsed;
  const base = `/org/${ctx.orgId}`;

  return (
    <main>
      <h1 className="text-2xl font-bold">Обзор обучения</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Данные обновляются автоматически по мере занятий работников.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Мест занято"
          value={`${overview.seatsUsed} / ${overview.seatsTotal}`}
          hint={freeSeats > 0 ? `${freeSeats} свободно` : "все места распределены"}
        />
        <Card
          label="Занимались за неделю"
          value={String(overview.activeLast7d)}
          hint={`из ${overview.activeMembers} работников`}
        />
        <Card
          label="Средний прогресс"
          value={`${Math.round(overview.avgProgress * 100)}%`}
        />
        <Card label="Сертификатов" value={String(overview.certificates)} />
      </section>

      {/* Что требует внимания — раньше, чем таблицы. */}
      {(freeSeats > 0 || overview.notStarted > 0) && overview.seatsTotal > 0 ? (
        <section className="mt-6 space-y-3">
          {freeSeats > 0 ? (
            <Notice
              tone="amber"
              title={`${freeSeats} ${plural(freeSeats, "место не занято", "места не заняты", "мест не заняты")}`}
              body="Оплаченные места простаивают. Создайте коды доступа и раздайте их сотрудникам."
              action={{ href: `${base}/invites`, label: "Создать коды" }}
            />
          ) : null}
          {overview.notStarted > 0 ? (
            <Notice
              tone="slate"
              title={`${overview.notStarted} ${plural(overview.notStarted, "работник не приступал", "работника не приступали", "работников не приступали")}`}
              body="Учётка есть, но ни одного урока не открыто."
              action={{ href: `${base}/employees`, label: "Посмотреть" }}
            />
          ) : null}
        </section>
      ) : null}

      {/* Встречи с тренером идут выше лицензий: дата ближайшей — то, что
          ответственному нужно знать сейчас, а не по итогам месяца. */}
      <LiveSessionsBlock orgId={ctx.orgId} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Лицензии</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {overview.licenses.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/55">
              Лицензий пока нет. Свяжитесь с нами, чтобы добавить курсы для вашей
              команды.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Курс</th>
                  <th className="px-4 py-3 font-medium">Места</th>
                  <th className="px-4 py-3 font-medium">Доступ до</th>
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
                      {l.expiresAt ? l.expiresAt.toLocaleDateString("ru-RU") : "бессрочно"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="mt-8 flex items-start gap-2 rounded-xl border border-foreground/10 bg-background p-4 text-sm text-foreground/65">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <span>
          Работники учатся под условными обозначениями вида{" "}
          <span className="font-mono text-foreground/80">{ctx.orgSlug}-0001</span>.
          Фамилии, e-mail и телефоны сотрудников на платформе не хранятся —
          соответствие кодов людям ведёте вы у себя.
        </span>
      </p>
    </main>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-foreground/50">{hint}</p> : null}
    </div>
  );
}

function Notice({
  tone,
  title,
  body,
  action,
}: {
  tone: "amber" | "slate";
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  const amber = tone === "amber";
  return (
    <div
      className={
        amber
          ? "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-600/25 bg-amber-500/5 p-4"
          : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background p-4"
      }
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className={amber ? "mt-0.5 size-4 shrink-0 text-amber-600" : "mt-0.5 size-4 shrink-0 text-foreground/40"}
        />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-foreground/60">{body}</p>
        </div>
      </div>
      <Link
        href={action.href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
      >
        {action.label}
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

/** Русская форма множественного числа для 1 / 2-4 / 5+. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
