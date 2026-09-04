import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { db } from "@/lib/db";
import {
  BASE_PRICE_TIYN,
  bundlePriceTiyn,
  formatDuration,
  isPriceWithinRange,
  MIN_B2B_SEATS,
  PRICE_MATRIX,
  priceBand,
  quoteSeats,
  SEAT_TIERS,
  SUBSCRIPTION_MONTH_TIYN,
  SUBSCRIPTION_YEAR_TIYN,
  TRAINER_PACK_USD,
  VOLUME_TIERS,
} from "@/lib/pricing";
import { currency, usdToTiyn } from "@/lib/currency";
import { PROMO, promoActive, promoEndsLabel } from "@/lib/pricing/promo";
import {
  AUDIENCE_EXAMPLES,
  AUDIENCE_TITLE,
  formatAmount,
  MARKETS,
  PER_BYN,
  RATES_AS_OF,
} from "@/lib/pricing/markets";
import { ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { B2bCalculator } from "./b2b-calculator";

export const metadata: Metadata = {
  title: "Тарифы",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Справочник тарифов для владельца: на что опираться, назначая цену новому курсу
 * и договариваясь с организацией. Цифры берутся из lib/pricing — того же модуля,
 * что считает подсказку в карточке курса и расчёт места в лицензии, поэтому
 * справочник не может разойтись с тем, что реально применяется.
 *
 * Обоснование каждой цифры — docs/PRICING-PLAN.md; здесь только рабочая выжимка.
 */
export default async function PricingPage() {
  // Пакет тренера задан в долларах (lib/pricing TRAINER_PACK) — переводим по
  // тому же курсу, что и витрина.
  const trainerTiyn = usdToTiyn(TRAINER_PACK_USD, (await currency.getRates()).rates);
  const rows = await db.course.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      audience: true,
      priceTiyn: true,
      status: true,
      accessDuration: true,
      modules: {
        select: {
          lessons: {
            where: { status: "PUBLISHED" },
            select: { durationSec: true },
          },
        },
      },
    },
  });

  // Объём курса — сумма длительностей опубликованных уроков. Он же определяет
  // ступень цены: 39-минутный курс и шестичасовой не могут стоить одинаково.
  const courses = rows.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    const totalSec = lessons.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
    return {
      id: c.id,
      title: c.title,
      audience: c.audience,
      priceTiyn: c.priceTiyn,
      status: c.status,
      accessDuration: c.accessDuration,
      lessons: lessons.length,
      totalSec: totalSec || null,
      band: priceBand(c.audience, totalSec || null),
    };
  });

  const published = courses.filter((c) => c.status === "PUBLISHED");
  const offGrid = courses.filter(
    (c) => !isPriceWithinRange(c.audience, c.priceTiyn, c.totalSec),
  );

  return (
    <main>
      <h1 className="text-2xl font-bold">Тарифы</h1>
      <p className="mt-1 max-w-3xl text-sm text-foreground/60">
        Рекомендованные цены для физлиц и организаций. На них опираемся, когда
        назначаем цену новому курсу и готовим договор. Полное обоснование — в{" "}
        <span className="font-mono text-foreground/80">docs/PRICING-PLAN.md</span>.
      </p>
      {promoActive() ? (
        /* Владелец должен видеть это первым: в справочнике ниже — ПОЛНЫЕ цены,
           а витрина и калькулятор сейчас показывают половину. Без этой строки
           легко назвать клиенту цифру из таблицы и разойтись с сайтом. */
        <p className="mt-3 flex max-w-3xl items-start gap-2 rounded-lg border border-brand/30 bg-brand/[0.06] p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-strong" />
          <span>
            <b>Идёт акция −{PROMO.percent} % до {promoEndsLabel("ru")}.</b> В таблицах
            ниже — полные цены; витрина, калькулятор и заявки показывают половину.
            Срок и размер меняются в{" "}
            <span className="font-mono text-foreground/80">src/lib/pricing/promo.ts</span>.
          </span>
        </p>
      ) : null}

      <p className="mt-2 flex max-w-3xl items-start gap-2 rounded-lg bg-foreground/[0.03] p-3 text-sm text-foreground/65">
        <Info className="mt-0.5 size-4 shrink-0" />
        {/* Цена — решение владельца, а не системы: справочник подсказывает и
            предупреждает, но ничего не навязывает и не переписывает. */}
        Это подсказка, а не ограничение. Фактическую цену любого курса вы меняете
        в его карточке, и она сохраняется — сетка лишь показывает, где значение
        расходится с рекомендацией.
      </p>

      {/* ── Физлица ──────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Физические лица</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Цена определяется классом курса — тем же полем «Для кого», что и фильтр
          витрины. Отраслевой дороже: у́же аудитория и меньше конкурентов.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Объём видео</th>
                {(["SPECIALIZED", "EVERYONE"] as const).map((a) => (
                  <th key={a} className="px-4 py-3 font-medium">
                    {AUDIENCE_TITLE[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VOLUME_TIERS.map((tier) => (
                <tr key={tier.key} className="border-b border-foreground/5 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{tier.label}</span>
                    <span className="ml-2 text-xs text-foreground/50">{tier.hint}</span>
                  </td>
                  {(["SPECIALIZED", "EVERYONE"] as const).map((a) => {
                    const band = PRICE_MATRIX[a][tier.key];
                    return (
                      <td key={a} className="px-4 py-3">
                        <span className="text-lg font-bold tabular-nums">
                          {formatAmount(band.price / 100)} BYN
                        </span>
                        <p className="text-xs text-foreground/50">
                          коридор {formatAmount(band.min / 100)}–
                          {formatAmount(band.max / 100)}
                        </p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-foreground/55">
          {AUDIENCE_TITLE.SPECIALIZED}: {AUDIENCE_EXAMPLES.SPECIALIZED}.{" "}
          {AUDIENCE_TITLE.EVERYONE}: {AUDIENCE_EXAMPLES.EVERYONE}.
        </p>
        <p className="mt-2 text-xs text-foreground/55">
          Цена растёт с объёмом ступенями, а не пропорционально часам: мы продаём
          результат, а не хронометраж, а AI-практика собирается на любой курс
          независимо от его длины. Курс без видео считается стандартным, пока
          фабрика не зальёт уроки.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MiniCard
            title="Пакет из 3 курсов"
            value={`${formatAmount(
              bundlePriceTiyn([
                BASE_PRICE_TIYN.SPECIALIZED,
                BASE_PRICE_TIYN.EVERYONE,
                BASE_PRICE_TIYN.EVERYONE,
              ]) / 100,
            )} BYN`}
            hint="отраслевой + 2 общих, −17 % к сумме"
          />
          <MiniCard
            title="Подписка на год"
            value={`${formatAmount(SUBSCRIPTION_YEAR_TIYN / 100)} BYN`}
            hint="вся библиотека, ≈ 2,6 отраслевых курса"
          />
          <MiniCard
            title="Подписка помесячно"
            value={`${formatAmount(SUBSCRIPTION_MONTH_TIYN / 100)} BYN`}
            hint="≈ 1/10 годовой — порог входа ниже"
          />
        </div>

        <p className="mt-3 flex items-start gap-2 text-xs text-foreground/55">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Пакет и подписка посчитаны, но пока не продаются в один шаг — единица
          продажи всё ещё курс. Цифры нужны для переговоров и планирования.
        </p>
      </section>

      {/* ── Сверка с фактическими ценами ─────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Ваши курсы</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Фактические цены против рекомендованных: видно, если что-то выбивается.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {courses.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/55">Курсов пока нет.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Курс</th>
                  <th className="px-4 py-3 font-medium">Класс</th>
                  <th className="px-4 py-3 font-medium">Объём</th>
                  <th className="px-4 py-3 font-medium">Доступ</th>
                  <th className="px-4 py-3 font-medium">Цена</th>
                  <th className="px-4 py-3 font-medium">Рекомендовано</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const ok = isPriceWithinRange(c.audience, c.priceTiyn, c.totalSec);
                  return (
                    <tr key={c.id} className="border-b border-foreground/5 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/courses/${c.id}`}
                          className="font-medium text-amber-700 hover:underline"
                        >
                          {c.title}
                        </Link>
                        {c.status !== "PUBLISHED" ? (
                          <span className="ml-2 text-xs text-foreground/45">
                            {c.status === "DRAFT" ? "черновик" : "архив"}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {AUDIENCE_TITLE[c.audience]}
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {formatDuration(c.totalSec)}
                        <p className="text-xs text-foreground/45">
                          {c.lessons} уроков · {c.band.tier.label}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {ACCESS_DURATION_LABELS[c.accessDuration]}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatAmount(c.priceTiyn / 100)} BYN
                      </td>
                      <td className="px-4 py-3 text-foreground/60 tabular-nums">
                        {formatAmount(c.band.price / 100)} BYN
                      </td>
                      <td className="px-4 py-3">
                        {ok ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                            <CheckCircle2 className="size-3.5" />в коридоре
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                            <AlertTriangle className="size-3.5" />вне коридора
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-2 text-xs text-foreground/55">
          «Доступ» — срок, который получит ученик, если при выдаче оставить «по
          тарифу курса». Задаётся в карточке курса, в сделке его можно
          переопределить. По тарифному плану базовый срок — год: материалы
          остаются у ученика, а AI-практика тратит токены и бессрочной быть не может.
        </p>

        {offGrid.length > 0 ? (
          <p className="mt-2 text-sm text-amber-700">
            {offGrid.length} {offGrid.length === 1 ? "курс" : "курса(-ов)"} вне
            рекомендованного коридора — проверьте, осознанно ли это.
          </p>
        ) : null}
      </section>

      {/* ── B2B ──────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Организации</h2>
        <p className="mt-1 max-w-3xl text-sm text-foreground/60">
          Место — доступ одного работника на год. Сетка сознательно консервативна:
          дешёвый онлайн не должен подрезать офлайн-тренинги, где чек в разы выше.
          Минимальный пакет — {MIN_B2B_SEATS} мест.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Пакет</th>
                <th className="px-4 py-3 font-medium">Мест</th>
                <th className="px-4 py-3 font-medium">Скидка</th>
                <th className="px-4 py-3 font-medium">Место в библиотеке / год</th>
                <th className="px-4 py-3 font-medium">Место на 1 курс / год</th>
              </tr>
            </thead>
            <tbody>
              {SEAT_TIERS.slice()
                .reverse()
                .map((tier) => {
                  const library = quoteSeats(tier.minSeats, SUBSCRIPTION_YEAR_TIYN);
                  const single = quoteSeats(tier.minSeats, BASE_PRICE_TIYN.SPECIALIZED);
                  return (
                    <tr key={tier.minSeats} className="border-b border-foreground/5 last:border-0">
                      <td className="px-4 py-3 font-medium">{tier.label}</td>
                      <td className="px-4 py-3 text-foreground/70">от {tier.minSeats}</td>
                      <td className="px-4 py-3 text-foreground/70">
                        −{Math.round(tier.discount * 100)} %
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatAmount(library.pricePerSeatTiyn / 100)} BYN
                      </td>
                      <td className="px-4 py-3 tabular-nums text-foreground/70">
                        {formatAmount(single.pricePerSeatTiyn / 100)} BYN
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <B2bCalculator
            courses={published.map((c) => ({
              id: c.id,
              title: c.title,
              priceTiyn: c.priceTiyn,
            }))}
            trainerTiyn={trainerTiyn}
          />
        </div>

        <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-foreground/70">
          <p className="font-semibold text-foreground">Аргумент для переговоров</p>
          <p className="mt-1">
            Двухдневный корпоративный тренинг обходится примерно в 100–150 BYN на
            человека за одно мероприятие. Годовая лицензия на 20 человек — это
            {" "}
            {formatAmount(quoteSeats(20, SUBSCRIPTION_YEAR_TIYN).pricePerSeatTiyn / 100)}{" "}
            BYN на сотрудника, но за 12 месяцев, и она учит каждого нового работника
            с первого дня. Условия — в{" "}
            <Link href="/offer-b2b" className="underline hover:text-foreground">
              оферте для организаций
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Другие рынки ─────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Другие рынки</h2>
        <p className="mt-1 max-w-3xl text-sm text-foreground/60">
          Справочные цены из тарифного исследования, курсы валют на {RATES_AS_OF}{" "}
          (1 бел. руб. ≈ {PER_BYN.RUB} рос. руб. ≈ {PER_BYN.KZT} тенге ≈{" "}
          {formatAmount(PER_BYN.UZS)} сум).
          Витрина пока считает цену конвертацией из BYN, поэтому эти значения —
          ориентир для переговоров, а не то, что видит покупатель.
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-foreground/10 bg-background">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Рынок</th>
                <th className="px-4 py-3 font-medium">Отраслевой</th>
                <th className="px-4 py-3 font-medium">Общая тема</th>
                <th className="px-4 py-3 font-medium">Пакет</th>
                <th className="px-4 py-3 font-medium">Подписка / год</th>
              </tr>
            </thead>
            <tbody>
              {MARKETS.map((m) => (
                <tr key={m.code} className="border-b border-foreground/5 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{m.country}</p>
                    <p className="text-xs text-foreground/45">
                      {m.domain ?? "домен не подключён"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">
                      {formatAmount(m.prices.SPECIALIZED.median)} {m.currency}
                    </span>
                    <p className="text-xs text-foreground/45">
                      {formatAmount(m.prices.SPECIALIZED.min)}–
                      {formatAmount(m.prices.SPECIALIZED.max)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">
                      {formatAmount(m.prices.EVERYONE.median)} {m.currency}
                    </span>
                    <p className="text-xs text-foreground/45">
                      {formatAmount(m.prices.EVERYONE.min)}–
                      {formatAmount(m.prices.EVERYONE.max)}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground/70">
                    {formatAmount(m.bundle)} {m.currency}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground/70">
                    {formatAmount(m.subscriptionYear)} {m.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-3 space-y-1 text-xs text-foreground/55">
          {MARKETS.map((m) => (
            <li key={m.code}>
              <span className="font-medium text-foreground/70">{m.country}:</span>{" "}
              {m.benchmark}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function MiniCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-foreground/50">{title}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-foreground/50">{hint}</p>
    </div>
  );
}
