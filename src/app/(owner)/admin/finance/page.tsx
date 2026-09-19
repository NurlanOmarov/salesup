import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { db } from "@/lib/db";
import {
  getFinanceSettings,
  getIncomes,
  getIncomeYears,
  getOrgBillingCounts,
  totalsByCurrency,
  totalsByMonth,
} from "@/lib/finance/service";
import {
  COUNTRY_LABELS,
  formatBp,
  formatMoney,
  formatRate,
  payeeGross,
  type Country,
} from "@/lib/finance/split";
import { IncomeForm } from "./income-form";
import { DeleteIncomeButton, FinanceSettingsForm } from "./finance-manage";

export const metadata: Metadata = {
  title: "Доходы",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

/**
 * Учёт полученных денег (B2B и B2C) и гонораров: сколько пришло, сколько ушло
 * на налоги, сколько получил каждый. Получатели — инициалами. Итоги по валютам
 * не смешиваются: тенге и рубли складывать без курса на дату нельзя.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; org?: string }>;
}) {
  const sp = await searchParams;
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : null;

  const [incomes, years, settings, billing, orgs, courses] = await Promise.all([
    getIncomes(year),
    getIncomeYears(),
    getFinanceSettings(),
    getOrgBillingCounts(),
    db.organization.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [{ billing: "asc" }, { name: "asc" }],
      select: { id: true, name: true, site: true, billing: true },
    }),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const totals = totalsByCurrency(incomes);
  const months = totalsByMonth(incomes);
  const rates = Object.fromEntries(settings.rates.map((r) => [r.country, r.rateMilli]));
  const active = settings.payees.filter((p) => p.isActive);
  const coOwners = active.filter((p) => p.role === "CO_OWNER");
  const authors = active.filter((p) => p.role === "AUTHOR");
  const payeeLabels = settings.payees.map((p) => p.label);

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Доходы</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Полученные оплаты B2B и B2C, налоги и гонорары. Суммы вносятся вручную по факту
            поступления денег.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          <PeriodLink href="/admin/finance" active={year === null}>
            Всё время
          </PeriodLink>
          {years.map((y) => (
            <PeriodLink key={y} href={`/admin/finance?year=${y}`} active={year === y}>
              {y}
            </PeriodLink>
          ))}
        </nav>
      </div>

      {/* ── Сводка ─────────────────────────────────────────────────────── */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/orgs"
          className="rounded-xl border border-foreground/10 bg-background p-4 transition-colors hover:bg-foreground/[0.02]"
        >
          <p className="text-xs uppercase tracking-wide text-foreground/50">Организации</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {billing.paid}
            <span className="text-base font-medium text-foreground/45"> платных</span>
          </p>
          <p className="text-xs text-foreground/50">и {billing.pilot} на пилоте</p>
        </Link>
        <Stat
          label="Поступлений"
          value={String(incomes.length)}
          hint={
            incomes.length > 0
              ? `B2B ${incomes.filter((i) => i.channel === "B2B").length} · B2C ${
                  incomes.filter((i) => i.channel === "B2C").length
                }`
              : "пока ни одного"
          }
        />
      </section>

      {totals.map((t) => (
        <section
          key={t.currency}
          className="mt-3 rounded-xl border border-foreground/10 bg-background p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {t.currency} · {t.count} {t.count === 1 ? "поступление" : "поступлений"}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Money label="Получено" value={formatMoney(t.gross, t.currency)} strong />
            <Money label="Налоги и сборы" value={formatMoney(t.tax, t.currency)} muted />
            <Money label="Чистая прибыль" value={formatMoney(t.net, t.currency)} strong />
          </div>

          {/* Каждый получатель: доход — его доля выручки до налогов, чистая —
              что он получил на руки после налогов и сборов. */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {settings.payees.map((p) => {
              const v = t.byPayee.get(p.label) ?? { gross: 0, net: 0 };
              return (
                <div key={p.id} className="rounded-lg border border-foreground/10 p-3">
                  <p className="text-sm font-semibold">
                    {p.label}{" "}
                    <span className="font-normal text-foreground/50">
                      {p.role === "CO_OWNER"
                        ? `совладелец · ${formatBp(p.shareBp ?? 0)} чистой прибыли`
                        : "автор курса · остаток чистой прибыли"}
                    </span>
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Money label="Доход" value={formatMoney(v.gross, t.currency)} />
                    <Money label="Налоги" value={formatMoney(v.gross - v.net, t.currency)} muted />
                    <Money label="Чистая прибыль" value={formatMoney(v.net, t.currency)} strong />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-foreground/50">
            B2B: {formatMoney(t.byChannel.B2B.gross, t.currency)} ({t.byChannel.B2B.count}) · B2C:{" "}
            {formatMoney(t.byChannel.B2C.gross, t.currency)} ({t.byChannel.B2C.count})
          </p>
        </section>
      ))}

      {/* ── Новое поступление ──────────────────────────────────────────── */}
      <section id="new" className="mt-8 scroll-mt-20">
        <h2 className="text-lg font-semibold">Записать поступление</h2>
        <p className="mt-1 text-sm text-foreground/55">
          Налоги считаются по ставке страны покупателя, от чистой прибыли совладелец получает
          свою долю, автор курса — остаток. Запись от организации-пилота переводит её в платные.
        </p>
        <div className="mt-4 rounded-xl border border-foreground/10 bg-background p-4">
          {authors.length === 0 ? (
            <p className="text-sm text-foreground/60">
              Нет ни одного автора-получателя — добавьте его в таблицу Payee.
            </p>
          ) : (
            <IncomeForm
              orgs={orgs}
              courses={courses}
              coOwners={coOwners.map((p) => ({ id: p.id, label: p.label, shareBp: p.shareBp }))}
              authors={authors.map((p) => ({ id: p.id, label: p.label }))}
              rates={rates}
              defaultOrgId={sp.org ?? null}
            />
          )}
        </div>
      </section>

      {/* ── Журнал поступлений ─────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Поступления</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
          {incomes.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="mx-auto size-8 text-foreground/25" />
              <p className="mt-3 text-sm text-foreground/55">
                {year ? `За ${year} год поступлений нет.` : "Поступлений пока нет."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Покупатель</th>
                  <th className="px-4 py-3 font-medium">Страна</th>
                  <th className="px-4 py-3 text-right font-medium">Получено</th>
                  <th className="px-4 py-3 text-right font-medium">Налоги</th>
                  <th className="px-4 py-3 text-right font-medium">Чистая</th>
                  {payeeLabels.map((l) => (
                    <th key={l} className="px-4 py-3 text-right font-medium">
                      {l}
                    </th>
                  ))}
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {incomes.map((i) => (
                  <tr key={i.id} className="border-b border-foreground/5 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">
                      {i.receivedAt.toLocaleDateString("ru-RU", { timeZone: "UTC" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="mr-1.5 rounded bg-foreground/5 px-1.5 py-0.5 text-xs text-foreground/60">
                        {i.channel}
                      </span>
                      {i.org ? (
                        <Link href={`/admin/orgs/${i.org.id}`} className="text-amber-700 hover:underline">
                          {i.org.name}
                        </Link>
                      ) : (
                        (i.buyerRef ?? "—")
                      )}
                      {i.course ? (
                        <p className="text-xs text-foreground/50">{i.course.title}</p>
                      ) : null}
                      {i.note ? <p className="text-xs text-foreground/45">{i.note}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground/70">
                      {COUNTRY_LABELS[i.country as Country] ?? i.country}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatMoney(i.grossTiyn, i.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-foreground/60">
                      {formatMoney(i.taxTiyn, i.currency)}
                      <p className="text-xs text-foreground/40">
                        {i.taxTiyn === 0 ? "" : effectiveRate(i.taxTiyn, i.grossTiyn, i.rateMilli)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {formatMoney(i.netTiyn, i.currency)}
                    </td>
                    {payeeLabels.map((l) => {
                      const s = i.shares.find((x) => x.payee.label === l);
                      return (
                        <td key={l} className="whitespace-nowrap px-4 py-3 text-right">
                          {s ? formatMoney(s.amountTiyn, i.currency) : "—"}
                          {s && i.netTiyn > 0 ? (
                            <p className="text-xs text-foreground/45">
                              доход{" "}
                              {formatMoney(payeeGross(s.amountTiyn, i.netTiyn, i.grossTiyn), i.currency)}
                            </p>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 text-right">
                      <DeleteIncomeButton
                        id={i.id}
                        label={`${formatMoney(i.grossTiyn, i.currency)} от ${i.receivedAt.toLocaleDateString("ru-RU", { timeZone: "UTC" })}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── По месяцам ─────────────────────────────────────────────────── */}
      {months.length > 1 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">По месяцам</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
            <table className="w-full text-sm tabular-nums">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Месяц</th>
                  <th className="px-4 py-3 text-right font-medium">Получено</th>
                  <th className="px-4 py-3 text-right font-medium">Налоги</th>
                  <th className="px-4 py-3 text-right font-medium">Чистая</th>
                  {payeeLabels.map((l) => (
                    <th key={l} className="px-4 py-3 text-right font-medium">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={`${m.month}-${m.currency}`} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3">
                      {MONTHS[Number(m.month.slice(5)) - 1]} {m.month.slice(0, 4)}
                      <span className="ml-1.5 text-xs text-foreground/45">× {m.count}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatMoney(m.gross, m.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-foreground/60">
                      {formatMoney(m.tax, m.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {formatMoney(m.net, m.currency)}
                    </td>
                    {payeeLabels.map((l) => {
                      const v = m.byPayee.get(l) ?? { gross: 0, net: 0 };
                      return (
                        <td key={l} className="whitespace-nowrap px-4 py-3 text-right">
                          {formatMoney(v.net, m.currency)}
                          <p className="text-xs text-foreground/45">
                            доход {formatMoney(v.gross, m.currency)}
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Настройки ──────────────────────────────────────────────────── */}
      <section className="mt-8">
        <details className="rounded-xl border border-foreground/10 bg-background p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Ставки и доли{" "}
            <span className="font-normal text-foreground/50">
              ·{" "}
              {settings.rates
                .map((r) => `${r.country} ${formatRate(r.rateMilli)}`)
                .join(" · ")}
            </span>
          </summary>
          <div className="mt-4">
            <FinanceSettingsForm
              rates={rates}
              coOwners={coOwners.map((p) => ({ id: p.id, label: p.label, shareBp: p.shareBp }))}
            />
          </div>
        </details>
      </section>
    </main>
  );
}

/** Ставка по записи; если налог правили вручную — фактический процент. */
function effectiveRate(tax: number, gross: number, rateMilli: number): string {
  const byRate = Math.round((gross * rateMilli) / 100_000);
  if (Math.abs(byRate - tax) <= 100) return formatRate(rateMilli);
  return `факт ${formatRate(Math.round((tax / gross) * 100_000))}`;
}

function PeriodLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 transition-colors ${
        active
          ? "bg-amber-500/10 font-semibold text-amber-700"
          : "text-foreground/60 hover:bg-foreground/5"
      }`}
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-foreground/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-foreground/50">{hint}</p> : null}
    </div>
  );
}

function Money({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-foreground/50">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${strong ? "text-lg font-bold" : "text-lg"} ${
          muted ? "text-foreground/60" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
