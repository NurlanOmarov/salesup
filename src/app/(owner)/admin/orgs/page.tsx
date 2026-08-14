import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import { getOrgsList } from "@/lib/org/reports";
import { OrgStatusBadge, SeatsBar } from "./org-ui";

export const metadata: Metadata = {
  title: "Организации",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Реестр корпоративных клиентов. Главный вопрос, на который отвечает экран:
 * «кто сколько мест купил и сколько из них реально учится» — утилизация мест
 * прямо в таблице, потому что именно она решает, продлит клиент или нет.
 */
export default async function OrgsPage() {
  const orgs = await getOrgsList();
  const totals = orgs.reduce(
    (acc, o) => ({
      seatsTotal: acc.seatsTotal + o.seatsTotal,
      seatsUsed: acc.seatsUsed + o.seatsUsed,
      members: acc.members + o.members,
    }),
    { seatsTotal: 0, seatsUsed: 0, members: 0 },
  );

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Организации</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Корпоративные клиенты: лицензии, места и ответственные представители.
          </p>
        </div>
        <Link
          href="/admin/orgs/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          + Создать организацию
        </Link>
      </div>

      {orgs.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Организаций" value={String(orgs.length)} />
          <Stat
            label="Мест продано"
            value={String(totals.seatsTotal)}
            hint={`занято ${totals.seatsUsed}`}
          />
          <Stat label="Работников учится" value={String(totals.members)} />
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-xl border border-foreground/10 bg-background">
        {orgs.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto size-8 text-foreground/25" />
            <p className="mt-3 font-medium">Пока нет организаций</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-foreground/55">
              Заведите клиента, выдайте лицензию на курс и назначьте ответственного
              представителя — дальше компания заводит работников сама.
            </p>
            <Link
              href="/admin/orgs/new"
              className="mt-4 inline-block rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              Создать первую
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Организация</th>
                <th className="px-4 py-3 font-medium">Места</th>
                <th className="px-4 py-3 font-medium">Работники</th>
                <th className="px-4 py-3 font-medium">Лицензии до</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orgs/${o.id}`}
                      className="font-medium text-amber-700 hover:underline"
                    >
                      {o.name}
                    </Link>
                    <p className="font-mono text-xs text-foreground/45">
                      {o.slug}-0001…
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <SeatsBar used={o.seatsUsed} total={o.seatsTotal} />
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {o.members}
                    {o.admins > 0 ? (
                      <span className="text-foreground/40"> · {o.admins} отв.</span>
                    ) : (
                      <span className="ml-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700">
                        нет ответственного
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {o.nextExpiryAt
                      ? o.nextExpiryAt.toLocaleDateString("ru-RU")
                      : o.licenses === 0
                        ? "нет лицензий"
                        : "бессрочно"}
                  </td>
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-foreground/50">
        <ExternalLink className="size-3.5" />
        Условия для клиентов — в публичной оферте для организаций:{" "}
        <Link href="/offer-b2b" className="underline hover:text-foreground">
          /offer-b2b
        </Link>
      </p>
    </main>
  );
}

function Stat({
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
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="text-xs text-foreground/50">{hint}</p> : null}
    </div>
  );
}
