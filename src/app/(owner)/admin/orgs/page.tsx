import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import { getOrgsList } from "@/lib/org/reports";
import { nextOrgStepHint } from "@/lib/org/setup";
import { getOrgIdsAwaitingDelivery } from "@/lib/org/delivery";
import { CertificatesBadge, OrgBillingBadge, OrgStatusBadge, SeatsBar } from "./org-ui";
import { DemoQuickSelect } from "./demo-quick-select";
import { OrgProgressButton } from "./org-progress-dialog";
import { pluralRu } from "@/lib/courses/plural";
import { Input } from "@/components/ui/input";

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
export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim().toLowerCase() ?? "";
  const [orgs, awaitingDelivery] = await Promise.all([getOrgsList(), getOrgIdsAwaitingDelivery()]);
  // Ищем по названию/slug и по e-mail ответственного (контактный в карточке
  // или логин ORG_ADMIN). Сводка сверху остаётся по всему реестру.
  const emailsOf = (o: (typeof orgs)[number]) =>
    [...new Set([o.contactEmail, ...o.adminEmails].filter((e): e is string => !!e))];
  const shown = query
    ? orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(query) ||
          o.slug.toLowerCase().includes(query) ||
          emailsOf(o).some((e) => e.toLowerCase().includes(query)),
      )
    : orgs;
  const totals = orgs.reduce(
    (acc, o) => ({
      seatsTotal: acc.seatsTotal + o.seatsTotal,
      seatsUsed: acc.seatsUsed + o.seatsUsed,
      members: acc.members + o.members,
      onDemo: acc.onDemo + (o.demoMixed || o.demoPercent != null ? 1 : 0),
      paid: acc.paid + (o.billing === "PAID" ? 1 : 0),
      unpaid:
        acc.unpaid +
        (o.billing === "PAID" && !o.hasIncome && o.status !== "ARCHIVED" ? 1 : 0),
    }),
    { seatsTotal: 0, seatsUsed: 0, members: 0, onDemo: 0, paid: 0, unpaid: 0 },
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
          <Stat
            label="Организаций"
            value={String(orgs.length)}
            hint={`платных ${totals.paid} · пилотов ${orgs.length - totals.paid}`}
            // Платный клиент без поступления — оплата мимо учёта, а не скидка.
            alert={
              totals.unpaid > 0
                ? { text: `${totals.unpaid} без записи оплаты`, href: "/admin/finance" }
                : undefined
            }
          />
          <Stat
            label="Мест продано"
            value={String(totals.seatsTotal)}
            hint={`занято ${totals.seatsUsed}`}
          />
          <Stat
            label="Работников учится"
            value={String(totals.members)}
            hint={
              totals.onDemo > 0
                ? `${totals.onDemo} ${pluralRu(totals.onDemo, "клиент", "клиента", "клиентов")} на демо-доступе`
                : undefined
            }
          />
        </div>
      ) : null}

      {orgs.length > 0 ? (
        <form className="mt-5" action="/admin/orgs">
          <Input
            name="q"
            defaultValue={q?.trim()}
            placeholder="Поиск по компании или e-mail ответственного…"
            className="max-w-md"
          />
        </form>
      ) : null}

      {/* Колонок стало больше — на узком экране таблица прокручивается, а не жмётся. */}
      <div className="mt-5 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
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
        ) : shown.length === 0 ? (
          <p className="p-8 text-center text-foreground/50">
            Ничего не найдено.{" "}
            <Link href="/admin/orgs" className="underline hover:text-foreground">
              Сбросить поиск
            </Link>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Организация</th>
                <th className="px-4 py-3 font-medium">Места</th>
                <th className="px-4 py-3 font-medium">Работники</th>
                <th className="px-4 py-3 font-medium">Обучение</th>
                <th className="px-4 py-3 font-medium">Лицензии до</th>
                <th className="px-4 py-3 font-medium">Доступ</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/admin/orgs/${o.id}`}
                        className="font-medium text-amber-700 hover:underline"
                      >
                        {o.name}
                      </Link>
                      <OrgBillingBadge billing={o.billing} />
                    </div>
                    <p className="font-mono text-xs text-foreground/45">
                      {o.slug}-0001…
                    </p>
                    {/* При поиске видно, по какому адресу нашлась компания. */}
                    {query
                      ? emailsOf(o)
                          .filter((e) => e.toLowerCase().includes(query))
                          .map((e) => (
                            <p key={e} className="text-xs text-foreground/55">
                              {e}
                            </p>
                          ))
                      : null}
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
                  <td className="px-4 py-3">
                    {/* Средний прогресс виден сразу, без захода в карточку;
                        подробности — в окне по клику, не теряя место в списке.
                        Медаль рядом — у клиента уже есть выданный сертификат. */}
                    <div className="flex items-center gap-2">
                      <OrgProgressButton
                        orgId={o.id}
                        orgName={o.name}
                        progress={o.avgProgress}
                        disabled={o.licenses === 0}
                      />
                      <CertificatesBadge
                        issued={o.certificates.issued}
                        ready={o.certificates.ready}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {o.nextExpiryAt
                      ? o.nextExpiryAt.toLocaleDateString("ru-RU")
                      : o.licenses === 0
                        ? "нет лицензий"
                        : "бессрочно"}
                  </td>
                  <td className="px-4 py-3">
                    <DemoQuickSelect
                      orgId={o.id}
                      percent={o.demoPercent}
                      mixed={o.demoMixed}
                      disabled={o.licenses === 0}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={o.status} />
                    {/* Подсказка вместо необходимости открывать карточку и
                        вспоминать, на чём остановились с этим клиентом. */}
                    {o.status === "ACTIVE" && nextOrgStepHint(o) ? (
                      <p className="mt-1 text-xs text-amber-700">
                        дальше: {nextOrgStepHint(o)}
                      </p>
                    ) : o.status === "ACTIVE" && awaitingDelivery.has(o.id) ? (
                      // Кабинеты есть, а письма клиенту нет — так и забывают отправить.
                      <Link
                        href={`/admin/orgs/${o.id}#delivery`}
                        className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-800 hover:underline"
                      >
                        доступы не отправлены
                      </Link>
                    ) : null}
                    {/* Деньги — отдельная ось: клиент бывает запущен и при этом
                        не заведён в доходы. */}
                    {o.billing === "PAID" && !o.hasIncome && o.status !== "ARCHIVED" ? (
                      <Link
                        href={`/admin/finance?org=${o.id}#new`}
                        className="mt-1 block text-xs font-medium text-amber-700 hover:underline"
                      >
                        оплата не внесена
                      </Link>
                    ) : null}
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
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Строка-напоминание со ссылкой: то, что требует действия владельца. */
  alert?: { text: string; href: string };
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint ? <p className="text-xs text-foreground/50">{hint}</p> : null}
      {alert ? (
        <Link href={alert.href} className="text-xs font-medium text-amber-700 hover:underline">
          {alert.text}
        </Link>
      ) : null}
    </div>
  );
}
