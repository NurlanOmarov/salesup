"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { MIN_B2B_SEATS, quoteSeats, SEAT_TIERS } from "@/lib/pricing";
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
}

/**
 * Калькулятор корпоративного доступа: сколько сотрудников и что им открываем —
 * всю библиотеку или отдельные курсы. Считает по той же сетке, что и админка
 * (lib/pricing), поэтому цифра на лендинге и цифра в счёте не расходятся.
 *
 * Выбор курсов здесь принципиален: компании, которой нужен один отраслевой курс,
 * цена библиотеки показывала бы сумму втрое больше реальной — и разговор бы не
 * состоялся. Если выбранные курсы в сумме дороже подписки, предлагаем подписку:
 * платить больше за меньшее покупатель не должен.
 */
export function SeatsCalculator({
  subscriptionYearTiyn,
  courses = [],
  currencyCode = "BYN",
  rates = {},
  onQuote,
}: {
  subscriptionYearTiyn: number;
  courses?: CalculatorCourse[];
  /** Валюта страны домена: расчёт показывается в ней (мультидомен, D-013). */
  currencyCode?: CurrencyCode;
  rates?: RatesMap;
  /** Прокидываем выбор в форму заявки, чтобы менеджер не переспрашивал. */
  onQuote?: (value: {
    seats: number;
    courseTitles: string[];
    courseIds: string[];
    /** Выбранный тариф — уходит в заявку, чтобы в уведомлении была та же цена. */
    mode: "library" | "courses";
  }) => void;
}) {
  const [seats, setSeats] = useState(10);
  const [mode, setMode] = useState<"library" | "courses">("library");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const chosen = courses.filter((c) => selected.has(c.id));
  const chosenSum = chosen.reduce((sum, c) => sum + c.priceTiyn, 0);
  // Отдельные курсы никогда не стоят дороже подписки на всю библиотеку.
  const libraryIsBetter = mode === "courses" && chosenSum >= subscriptionYearTiyn;
  const retailTiyn =
    mode === "library" || chosen.length === 0 || libraryIsBetter
      ? subscriptionYearTiyn
      : chosenSum;

  const quote = quoteSeats(seats, retailTiyn);

  /** Один выход наружу: любое изменение отдаёт форме полный выбор целиком. */
  function emit(next: { seats?: number; mode?: "library" | "courses"; selected?: Set<string> }) {
    const nextMode = next.mode ?? mode;
    const nextSelected = next.selected ?? selected;
    const picked = nextMode === "courses" ? courses.filter((c) => nextSelected.has(c.id)) : [];
    onQuote?.({
      seats: next.seats ?? seats,
      courseTitles: picked.map((c) => c.title),
      courseIds: picked.map((c) => c.id),
      mode: nextMode,
    });
  }

  function change(next: number) {
    const clamped = Math.max(1, Math.min(500, next));
    setSeats(clamped);
    emit({ seats: clamped });
  }

  function changeMode(next: "library" | "courses") {
    setMode(next);
    emit({ mode: next });
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

      <div className="mt-3 flex items-center gap-3">
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
          className="h-11 w-24 rounded-lg border border-foreground/15 bg-background text-center text-lg font-semibold tabular-nums"
        />
        <button
          type="button"
          onClick={() => change(seats + 1)}
          aria-label={c.seatsMore}
          className="flex size-9 items-center justify-center rounded-lg border border-foreground/15 transition-colors hover:bg-foreground/5"
        >
          <Plus className="size-4" />
        </button>

        <div className="ml-auto flex gap-1.5">
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
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => changeMode("library")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                mode === "library"
                  ? "border-brand bg-brand/10 font-medium"
                  : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
              )}
            >
              {c.wholeLibrary}
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
              {c.separateCourses}
            </button>
          </div>

          {mode === "courses" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCourse(c.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
                    selected.has(c.id)
                      ? "border-brand bg-brand/10"
                      : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
                  )}
                >
                  {c.title}
                  <span className="ml-1.5 text-xs text-foreground/50">
                    {money(c.priceTiyn)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {mode === "courses" && chosen.length === 0 ? (
            <p className="mt-2 text-xs text-foreground/55">
              {c.pickCourses}
            </p>
          ) : null}

          {libraryIsBetter ? (
            <p className="mt-2 text-xs text-amber-700">
              {c.libraryCheaper}
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-foreground/50">
            {c.perSeatYear}
          </dt>
          <dd className="mt-0.5 text-2xl font-bold tabular-nums">
            {money(quote.pricePerSeatTiyn)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-foreground/50">
            {c.totalYear}
          </dt>
          <dd className="mt-0.5 text-2xl font-bold tabular-nums">
            {money(quote.totalTiyn)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-foreground/50">
            {c.perMonth}
          </dt>
          <dd className="mt-0.5 text-2xl font-bold tabular-nums">
            {money(Math.round(quote.pricePerSeatTiyn / 12))}
          </dd>
        </div>
      </dl>

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
        {mode === "courses" && chosen.length > 0 && !libraryIsBetter
          ? c.includesCourses(chosen.length)
          : c.includesLibrary}
      </p>
    </div>
  );
}
