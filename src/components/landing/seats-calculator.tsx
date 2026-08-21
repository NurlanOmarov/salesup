"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { MIN_B2B_SEATS, packRetailTiyn, quoteSeats, SEAT_TIERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/client";
import { businessContent } from "@/content/business-content";
// Импорт из конкретных модулей, а не из индекса: индекс тянет CurrencyService
// с доступом к файлам, и клиентская сборка на нём падает.
import { formatCurrency, type CurrencyCode } from "@/lib/currency/format";
import type { RatesMap } from "@/lib/currency/rates";

export interface CalculatorCourse {
  id: string;
  title: string;
  priceTiyn: number;
  /** Ось витрины `Course.audience`: отраслевой курс или общий навык. */
  audience: "EVERYONE" | "SPECIALIZED";
}

export type CalculatorMode = "industry" | "courses";

/**
 * Калькулятор корпоративного доступа: сколько сотрудников и какие курсы им
 * открываем. Считает по той же сетке, что и админка (lib/pricing), поэтому
 * цифра на лендинге и цифра в счёте не расходятся.
 *
 * Тарифа «вся библиотека» здесь нет намеренно. Курсы разнотематические (кухни,
 * туризм, медпреды, обувь), и отделу продаж одной компании релевантен ровно
 * один отраслевой курс плюс общие навыки; остальное в счёте выглядит навязанным
 * и удорожает предложение на курсы, которыми никто не воспользуется.
 *
 * Отсюда два режима: «курс вашей отрасли» (отраслевой на выбор + все общие
 * курсы, они применимы любому отделу) и ручная сборка набора для компаний с
 * несколькими направлениями.
 */
export function SeatsCalculator({
  courses = [],
  fallbackRetailTiyn,
  currencyCode = "BYN",
  rates = {},
  onQuote,
}: {
  courses?: CalculatorCourse[];
  /** База расчёта, когда каталог недоступен (пререндер без БД). */
  fallbackRetailTiyn: number;
  /** Валюта страны домена: расчёт показывается в ней (мультидомен, D-013). */
  currencyCode?: CurrencyCode;
  rates?: RatesMap;
  /** Прокидываем выбор в форму заявки, чтобы менеджер не переспрашивал. */
  onQuote?: (value: {
    seats: number;
    courseTitles: string[];
    courseIds: string[];
    mode: CalculatorMode;
  }) => void;
}) {
  const industries = courses.filter((c) => c.audience === "SPECIALIZED");
  const general = courses.filter((c) => c.audience === "EVERYONE");

  const [seats, setSeats] = useState(10);
  // Без отраслевых курсов режим «отрасль» бессмыслен — начинаем со сборки.
  const [mode, setMode] = useState<CalculatorMode>(
    industries.length > 0 ? "industry" : "courses",
  );
  const [industryId, setIndustryId] = useState<string>(industries[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const industry = industries.find((c) => c.id === industryId) ?? industries[0];
  // В отраслевом наборе общие курсы идут всегда: продажи есть продажи, они
  // применимы любому отделу — и именно они делают доступ на год осмысленным.
  const chosen =
    mode === "industry"
      ? [...(industry ? [industry] : []), ...general]
      : courses.filter((c) => selected.has(c.id));

  const retailTiyn =
    chosen.length > 0 ? packRetailTiyn(chosen.map((c) => c.priceTiyn)) : fallbackRetailTiyn;
  const quote = quoteSeats(seats, retailTiyn);

  /** Один выход наружу: любое изменение отдаёт форме полный выбор целиком. */
  function emit(next: {
    seats?: number;
    mode?: CalculatorMode;
    selected?: Set<string>;
    industryId?: string;
  }) {
    const nextMode = next.mode ?? mode;
    const nextIndustryId = next.industryId ?? industryId;
    const nextSelected = next.selected ?? selected;
    const nextIndustry =
      industries.find((c) => c.id === nextIndustryId) ?? industries[0];
    const picked =
      nextMode === "industry"
        ? [...(nextIndustry ? [nextIndustry] : []), ...general]
        : courses.filter((c) => nextSelected.has(c.id));
    onQuote?.({
      seats: next.seats ?? seats,
      courseTitles: picked.map((c) => c.title),
      courseIds: picked.map((c) => c.id),
      mode: nextMode,
    });
  }

  // Начальный набор тоже уходит в форму: человек может ничего не трогать и сразу
  // отправить заявку — без этого сервер не узнал бы, что именно он видел на экране.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => emit({}), []);

  function change(next: number) {
    const clamped = Math.max(1, Math.min(500, next));
    setSeats(clamped);
    emit({ seats: clamped });
  }

  function changeMode(next: CalculatorMode) {
    setMode(next);
    emit({ mode: next });
  }

  function changeIndustry(id: string) {
    setIndustryId(id);
    emit({ industryId: id });
  }

  function toggleCourse(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      emit({ selected: next });
      return next;
    });
  }

  // Цена задана в BYN, показываем её в валюте страны домена: казахстанской
  // компании расчёт в белорусских рублях ничего не говорит.
  const money = (tiyn: number) => formatCurrency(tiyn, currencyCode, rates);
  const c = businessContent(useLocale()).calculator;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <p className="text-sm font-semibold">{c.seats}</p>

      {/*
        flex-wrap обязателен: степпер и пресеты в одну нерушимую строку требовали
        ~400px, и на телефоне вся секция уезжала за край экрана.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => change(seats - 1)}
          aria-label={c.seatsLess}
          className="flex size-9 items-center justify-center rounded-lg border border-foreground/15 transition-colors hover:bg-foreground/5"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          min={1}
          max={500}
          value={seats}
          onChange={(e) => change(Number(e.target.value) || 1)}
          aria-label={c.seatsInput}
          className="h-11 w-20 rounded-lg border border-foreground/15 bg-background text-center text-lg font-semibold tabular-nums"
        />
        <button
          type="button"
          onClick={() => change(seats + 1)}
          aria-label={c.seatsMore}
          className="flex size-9 items-center justify-center rounded-lg border border-foreground/15 transition-colors hover:bg-foreground/5"
        >
          <Plus className="size-4" />
        </button>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {[5, 10, 20, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => change(n)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-sm transition-colors",
                seats === n
                  ? "bg-foreground/10 font-medium"
                  : "text-foreground/60 hover:bg-foreground/5",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {courses.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold">{c.whatOpens}</p>

          {industries.length > 0 ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => changeMode("industry")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  mode === "industry"
                    ? "border-brand bg-brand/10 font-medium"
                    : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
                )}
              >
                {c.byIndustry}
              </button>
              <button
                type="button"
                onClick={() => changeMode("courses")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  mode === "courses"
                    ? "border-brand bg-brand/10 font-medium"
                    : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
                )}
              >
                {c.ownSet}
              </button>
            </div>
          ) : null}

          {mode === "industry" ? (
            <div className="mt-3">
              {/* radiogroup, а не набор чекбоксов: отрасль у отдела одна, и
                  выбор «или-или» сразу задаёт правильную рамку разговора. */}
              <div role="radiogroup" aria-label={c.industryHint} className="flex flex-wrap gap-2">
                {industries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={industry?.id === item.id}
                    onClick={() => changeIndustry(item.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                      industry?.id === item.id
                        ? "border-brand bg-brand/10"
                        : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              {general.length > 0 ? (
                <p className="mt-2 text-xs text-foreground/55">
                  {c.alwaysIncluded(general.map((g) => g.title).join(", "))}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {courses.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected.has(item.id)}
                    onClick={() => toggleCourse(item.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                      selected.has(item.id)
                        ? "border-brand bg-brand/10"
                        : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
                    )}
                  >
                    {item.title}
                    <span className="ml-1.5 whitespace-nowrap text-xs text-foreground/50">
                      {money(item.priceTiyn)}
                    </span>
                  </button>
                ))}
              </div>
              {chosen.length === 0 ? (
                <p className="mt-2 text-xs text-foreground/55">{c.pickCourses}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/*
        Суммы: раньше три равные колонки с одинаково крупным шрифтом. В тенге
        числа семизначные — они не помещались, а знак валюты уезжал на
        следующую строку. Теперь цена за сотрудника (по ней и принимают решение)
        идёт крупно на всю ширину, годовая сумма и помесячная — под ней мельче;
        whitespace-nowrap не даёт разорвать сумму со знаком валюты.
      */}
      <dl className="mt-5 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
        <dt className="text-xs uppercase tracking-wide text-foreground/50">
          {c.perSeatYear}
        </dt>
        <dd className="mt-1 whitespace-nowrap text-3xl font-bold tabular-nums">
          {money(quote.pricePerSeatTiyn)}
        </dd>

        {/*
          Строки «подпись — сумма», а не две колонки: в тенге «1 477 900 ₸» шире
          половины карточки, и в двухколоночной сетке nowrap выталкивал сумму на
          соседнюю колонку — знак валюты наезжал на соседнее число.
        */}
        <div className="mt-3 space-y-2 border-t border-foreground/10 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs uppercase tracking-wide text-foreground/50">
              {c.totalYear(seats)}
            </dt>
            <dd className="whitespace-nowrap text-lg font-semibold tabular-nums">
              {money(quote.totalTiyn)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs uppercase tracking-wide text-foreground/50">
              {c.perMonth}
            </dt>
            <dd className="whitespace-nowrap text-lg font-semibold tabular-nums">
              {money(Math.round(quote.pricePerSeatTiyn / 12))}
            </dd>
          </div>
        </div>
      </dl>

      {/*
        Без этой строки цифры читались как «690 в год + 58 в месяц»: люди
        спрашивали, платить ли ещё и помесячно. Говорим прямо — счёт один.
      */}
      <p className="mt-2 text-xs text-foreground/50">{c.paymentNote}</p>

      {quote.tier ? (
        <p className="mt-4 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-sm text-emerald-800">
          {c.tierNote(quote.tier.label, Math.round(quote.discount * 100))}{" "}
          {c.saving(money(quote.savingTiyn))}
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-foreground/[0.04] px-3 py-2 text-sm text-foreground/65">
          {c.minSeatsNote(MIN_B2B_SEATS)}
        </p>
      )}

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/50">
        {SEAT_TIERS.slice()
          .reverse()
          .map((t) => (
            <li key={t.minSeats}>
              {c.tierRow(t.minSeats, Math.round(t.discount * 100))}
            </li>
          ))}
      </ul>

      <p className="mt-3 text-xs text-foreground/50">
        {chosen.length > 0 ? c.includesCourses(chosen.length) : c.includesAny}
      </p>
    </div>
  );
}
