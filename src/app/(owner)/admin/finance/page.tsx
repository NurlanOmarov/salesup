import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getIncomeSuggestion, getOrgsAwaitingIncome } from "@/lib/finance/pending";
import { loadRates } from "@/lib/finance/rates";
import {
  convertedAmounts,
  fxFromRates,
  resolveFx,
  type FxSnapshot,
} from "@/lib/finance/fx";
import {
  getFinanceSettings,
  getIncomeBuyers,
  getIncomes,
  getIncomeYears,
  getOrgBillingCounts,
  totalsByCurrency,
  totalsByMonth,
} from "@/lib/finance/service";
import {
  countryLabel,
  formatBp,
  formatMoney,
  formatRate,
  isCountry,
  payeeGross,
  type Country,
} from "@/lib/finance/split";
import { pluralRu } from "@/lib/courses/plural";
import { IncomeFilters, type IncomeFilterValue } from "./income-filters";
import { IncomeForm, type IncomeFormLists } from "./income-form";
import { EditIncomeButton, IncomeEditProvider } from "./income-edit";
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    from?: string;
    to?: string;
    country?: string;
    buyer?: string;
    q?: string;
    org?: string;
  }>;
}) {
  const sp = await searchParams;
  // Значения отбора чистим здесь: в запрос к базе и в компонент фильтров уходит
  // уже проверенное, а мусор в адресе просто игнорируется.
  const filters: IncomeFilterValue = {
    year: sp.year && /^\d{4}$/.test(sp.year) ? sp.year : "",
    from: sp.from && DATE_RE.test(sp.from) ? sp.from : "",
    to: sp.to && DATE_RE.test(sp.to) ? sp.to : "",
    country: isCountry(sp.country) ? sp.country : "",
    buyer: sp.buyer?.trim() ? sp.buyer.trim() : "",
    q: sp.q?.trim() ? sp.q.trim().slice(0, 100) : "",
    org: sp.org ?? "",
  };
  const year = filters.year ? Number(filters.year) : null;
  const retailOnly = filters.buyer === "retail";
  const filtered =
    Boolean(filters.year || filters.from || filters.to || filters.country || filters.buyer) ||
    Boolean(filters.q);

  const [
    incomes,
    years,
    buyers,
    settings,
    billing,
    awaiting,
    todayRates,
    suggestion,
    orgs,
    courses,
  ] = await Promise.all([
      getIncomes({
        year,
        from: filters.from,
        to: filters.to,
        country: filters.country,
        orgId: retailOnly ? null : filters.buyer,
        channel: retailOnly ? "B2C" : null,
        q: filters.q,
      }),
      getIncomeYears(),
      getIncomeBuyers(),
      getFinanceSettings(),
      getOrgBillingCounts(),
      getOrgsAwaitingIncome(),
      // Курсы НБ РК на сегодня — только для записей, у которых своего курса нет
      // (сделаны до появления снимка): показать вторую валюту хоть как-то.
      loadRates(),
      // Визард из карточки клиента: /admin/finance?org=<id>#new открывает форму
      // уже заполненной по его лицензиям.
      sp.org ? getIncomeSuggestion(sp.org) : Promise.resolve(null),
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
  // Записи, сделанные до появления снимка курса: их пересчёт — по сегодняшнему.
  const withoutStoredFx = incomes.filter(
    (i) => i.kztPerUnitMicro == null || i.kztPerBynMicro == null,
  ).length;
  // Справочники формы одинаковы для записи и для правки любой строки журнала.
  const lists: IncomeFormLists = {
    orgs,
    courses,
    coOwners: coOwners.map((p) => ({ id: p.id, label: p.label, shareBp: p.shareBp })),
    authors: authors.map((p) => ({ id: p.id, label: p.label })),
    rates,
  };

  return (
    <main>
      <div>
        <h1 className="text-2xl font-bold">Доходы</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Полученные оплаты B2B и B2C, налоги и гонорары. Суммы вносятся вручную по факту
          поступления денег.
        </p>
      </div>

      {/* ── Оплата не внесена ──────────────────────────────────────────
          Доступы клиенту выдают раньше денег: клиент отмечен платным, а
          поступления по нему нет ни одного — его выручки в учёте просто не
          существует. Поэтому напоминание стоит выше всех сводок. */}
      {awaiting.length > 0 ? (
        <section className="mt-5 rounded-xl border border-amber-600/30 bg-amber-500/5 p-4">
          <div className="flex items-baseline gap-2">
            <AlertCircle className="size-4 shrink-0 translate-y-0.5 text-amber-700" />
            <h2 className="font-semibold text-amber-800">
              Оплата не внесена · {awaiting.length}{" "}
              {pluralRu(awaiting.length, "организация", "организации", "организаций")}
            </h2>
          </div>
          <p className="mt-1 text-sm text-foreground/65">
            Клиенты отмечены платными, но поступлений по ним нет — этих денег нет ни в
            итогах ниже, ни в гонорарах. Форма откроется заполненной по лицензиям клиента:
            останется сверить сумму и дату.
          </p>
          <ul className="mt-3 divide-y divide-amber-600/15 border-t border-amber-600/15">
            {awaiting.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/admin/orgs/${o.id}`}
                    className="font-medium text-amber-800 hover:underline"
                  >
                    {o.name}
                  </Link>
                  <p className="text-xs text-foreground/55">
                    {countryLabel(o.suggestion.country)} · {o.suggestion.basis}
                    {o.suggestion.estimated && o.suggestion.bynTiyn > 0
                      ? " · цена места в лицензии не записана, посчитано по сетке"
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-foreground/70">
                    {o.suggestion.grossTiyn
                      ? `≈ ${formatMoney(o.suggestion.grossTiyn, o.suggestion.currency)}`
                      : "сумма не рассчитана"}
                  </span>
                  <Link
                    href={`/admin/finance?org=${o.id}#new`}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
                  >
                    Заполнить оплату
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Отбор ──────────────────────────────────────────────────────
          Стоит выше сводок нарочно: итоги считаются ровно по тому, что попало
          в отбор, и иначе было бы непонятно, за что эти цифры. */}
      <IncomeFilters
        value={filters}
        years={years}
        buyers={buyers.orgs}
        hasRetail={buyers.hasRetail}
      />

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
          {awaiting.length > 0 ? (
            <p className="text-xs font-medium text-amber-700">
              {awaiting.length} без записи оплаты
            </p>
          ) : null}
        </Link>
        <Stat
          label={filtered ? "Поступлений по отбору" : "Поступлений"}
          value={String(incomes.length)}
          hint={
            incomes.length > 0
              ? `B2B ${incomes.filter((i) => i.channel === "B2B").length} · B2C ${
                  incomes.filter((i) => i.channel === "B2C").length
                }`
              : filtered
                ? "под отбор ничего не подошло"
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
        <h2 className="text-lg font-semibold">
          {suggestion ? "Оплата клиента" : "Записать поступление"}
        </h2>
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
              // Смена ?org= меняет предзаполнение, а значения полей живут в
              // клиенте: без key форма осталась бы с данными прошлого клиента.
              key={sp.org ?? "blank"}
              {...lists}
              defaultOrgId={sp.org ?? null}
              suggestion={suggestion}
            />
          )}
        </div>
      </section>

      {/* ── Журнал поступлений ─────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Поступления</h2>
          <Link href="#filters" className="text-sm text-amber-700 hover:underline">
            {filtered ? "Отбор задан — изменить" : "Отобрать: период, страна, покупатель, поиск"}
          </Link>
        </div>
        <p className="mt-1 text-sm text-foreground/55">
          Вторая валюта — пересчёт по курсу НБ РК на день записи: он зафиксирован и
          задним числом не меняется. Запись можно поправить карандашом в строке.
        </p>
        {/* Провайдер держит справочники формы правки: одна копия на всю таблицу. */}
        <IncomeEditProvider lists={lists}>
          <div className="mt-4 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
            {incomes.length === 0 ? (
              <div className="p-10 text-center">
                <Wallet className="mx-auto size-8 text-foreground/25" />
                <p className="mt-3 text-sm text-foreground/55">
                  {filtered
                    ? "Под отбор ничего не подошло — измените период, страну или покупателя."
                    : "Поступлений пока нет."}
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
                  {incomes.map((i) => {
                    // Курс записи, а если его нет (строка старше снимка) — сегодняшний,
                    // и тогда пересчёт помечается как приблизительный.
                    const { fx, approximate } = resolveFx(
                      { kztPerUnitMicro: i.kztPerUnitMicro, kztPerBynMicro: i.kztPerBynMicro },
                      fxFromRates(i.currency, todayRates),
                    );
                    return (
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
                          {countryLabel(i.country)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                          {formatMoney(i.grossTiyn, i.currency)}
                          <SecondCurrency
                            tiyn={i.grossTiyn}
                            currency={i.currency}
                            fx={fx}
                            approximate={approximate}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-foreground/60">
                          {formatMoney(i.taxTiyn, i.currency)}
                          <SecondCurrency
                            tiyn={i.taxTiyn}
                            currency={i.currency}
                            fx={fx}
                            approximate={approximate}
                          />
                          <p className="text-xs text-foreground/40">
                            {i.taxTiyn === 0 ? "" : effectiveRate(i.taxTiyn, i.grossTiyn, i.rateMilli)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {formatMoney(i.netTiyn, i.currency)}
                          <SecondCurrency
                            tiyn={i.netTiyn}
                            currency={i.currency}
                            fx={fx}
                            approximate={approximate}
                          />
                        </td>
                        {payeeLabels.map((l) => {
                          const s = i.shares.find((x) => x.payee.label === l);
                          // Доход получателя — его доля выручки до налогов. Обе
                          // цифры нужны в тех же двух валютах, что и вся строка:
                          // иначе долю тенгового поступления считаешь в уме.
                          const gross = s
                            ? payeeGross(s.amountTiyn, i.netTiyn, i.grossTiyn)
                            : 0;
                          return (
                            <td key={l} className="whitespace-nowrap px-4 py-3 text-right">
                              {s ? formatMoney(s.amountTiyn, i.currency) : "—"}
                              {s ? (
                                <SecondCurrency
                                  tiyn={s.amountTiyn}
                                  currency={i.currency}
                                  fx={fx}
                                  approximate={approximate}
                                />
                              ) : null}
                              {s && i.netTiyn > 0 ? (
                                <>
                                  <p className="mt-1 text-xs text-foreground/45">
                                    доход {formatMoney(gross, i.currency)}
                                  </p>
                                  <SecondCurrency
                                    tiyn={gross}
                                    currency={i.currency}
                                    fx={fx}
                                    approximate={approximate}
                                    dim
                                  />
                                </>
                              ) : null}
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-2 py-3 text-right">
                          <EditIncomeButton
                            label={rowLabel(i)}
                            income={{
                              id: i.id,
                              receivedAt: i.receivedAt.toISOString().slice(0, 10),
                              channel: i.channel,
                              country: i.country as Country,
                              currency: i.currency,
                              grossTiyn: i.grossTiyn,
                              taxTiyn: i.taxTiyn,
                              orgId: i.orgId,
                              courseId: i.courseId,
                              buyerRef: i.buyerRef,
                              note: i.note,
                              authorId:
                                i.shares.find((x) => x.payee.role === "AUTHOR")?.payee.id ?? null,
                            }}
                          />
                          <DeleteIncomeButton id={i.id} label={rowLabel(i)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </IncomeEditProvider>
        {withoutStoredFx > 0 ? (
          <p className="mt-2 text-xs text-foreground/45">
            * У {withoutStoredFx}{" "}
            {pluralRu(withoutStoredFx, "записи", "записей", "записей")} курс дня не
            сохранён — они сделаны до того, как журнал стал его запоминать; для них
            показан сегодняшний курс НБ РК.
          </p>
        ) : null}
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

/** «44 000 тенге от 15.09.2026» — подпись строки для кнопок действий. */
function rowLabel(i: { grossTiyn: number; currency: string; receivedAt: Date }): string {
  return `${formatMoney(i.grossTiyn, i.currency)} от ${i.receivedAt.toLocaleDateString("ru-RU", { timeZone: "UTC" })}`;
}

/**
 * Та же сумма в другой валюте журнала. Курс — на день записи; если его не
 * сохранили, берём сегодняшний и говорим об этом в подсказке, а не молча.
 */
function SecondCurrency({
  tiyn,
  currency,
  fx,
  approximate,
  dim,
}: {
  tiyn: number;
  currency: string;
  fx: FxSnapshot;
  approximate: boolean;
  /** Пересчёт под уже второстепенной строкой («доход»): ещё тише. */
  dim?: boolean;
}) {
  const converted = convertedAmounts(tiyn, currency, fx);
  if (converted.length === 0) return null;
  return (
    <p
      className={`text-xs font-normal ${dim ? "text-foreground/30" : "text-foreground/40"}`}
      title={
        approximate
          ? "Курс на дату записи не сохранён — пересчёт по сегодняшнему курсу НБ РК"
          : "Пересчёт по курсу НБ РК на день записи"
      }
    >
      {converted.map((c) => `≈ ${formatMoney(c.tiyn, c.currency)}`).join(" · ")}
      {approximate ? " *" : ""}
    </p>
  );
}

/** Ставка по записи; если налог правили вручную — фактический процент. */
function effectiveRate(tax: number, gross: number, rateMilli: number): string {
  const byRate = Math.round((gross * rateMilli) / 100_000);
  if (Math.abs(byRate - tax) <= 100) return formatRate(rateMilli);
  return `факт ${formatRate(Math.round((tax / gross) * 100_000))}`;
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
