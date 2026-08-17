"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { MIN_B2B_SEATS, quoteSeats, SEAT_TIERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

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
  onQuote,
}: {
  subscriptionYearTiyn: number;
  courses?: CalculatorCourse[];
  /** Прокидываем выбор в форму заявки, чтобы менеджер не переспрашивал. */
  onQuote?: (value: { seats: number; courseTitles: string[] }) => void;
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

  function change(next: number) {
    const clamped = Math.max(1, Math.min(500, next));
    setSeats(clamped);
    onQuote?.({ seats: clamped, courseTitles: chosen.map((c) => c.title) });
  }

  function toggleCourse(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const titles = courses.filter((c) => next.has(c.id)).map((c) => c.title);
      onQuote?.({ seats, courseTitles: titles });
      return next;
    });
  }

  const byn = (tiyn: number) => (tiyn / 100).toLocaleString("ru-RU");

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <p className="text-sm font-semibold">Сколько сотрудников обучаем</p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => change(seats - 1)}
          aria-label="Меньше сотрудников"
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
          aria-label="Число сотрудников"
          className="h-11 w-24 rounded-lg border border-foreground/15 bg-background text-center text-lg font-semibold tabular-nums"
        />
        <button
          type="button"
          onClick={() => change(seats + 1)}
          aria-label="Больше сотрудников"
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
          <p className="text-sm font-semibold">Что открываем сотрудникам</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("library");
                onQuote?.({ seats, courseTitles: [] });
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                mode === "library"
                  ? "border-brand bg-brand/10 font-medium"
                  : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
              )}
            >
              Всю библиотеку
            </button>
            <button
              type="button"
              onClick={() => setMode("courses")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                mode === "courses"
                  ? "border-brand bg-brand/10 font-medium"
                  : "border-foreground/15 text-foreground/70 hover:bg-foreground/5",
              )}
            >
              Отдельные курсы
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
                    {byn(c.priceTiyn)} Br
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {mode === "courses" && chosen.length === 0 ? (
            <p className="mt-2 text-xs text-foreground/55">
              Выберите курсы — посчитаем по ним. Пока считаем по всей библиотеке.
            </p>
          ) : null}

          {libraryIsBetter ? (
            <p className="mt-2 text-xs text-amber-700">
              Выбранные курсы в сумме дороже годового доступа ко всей библиотеке —
              считаем по библиотеке, она выгоднее.
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-foreground/50">
            За сотрудника в год
          </dt>
          <dd className="mt-0.5 text-2xl font-bold tabular-nums">
            {byn(quote.pricePerSeatTiyn)} Br
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-foreground/50">
            Всего за год
          </dt>
          <dd className="mt-0.5 text-2xl font-bold tabular-nums">
            {byn(quote.totalTiyn)} Br
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-foreground/50">
            В месяц на человека
          </dt>
          <dd className="mt-0.5 text-2xl font-bold tabular-nums">
            {byn(Math.round(quote.pricePerSeatTiyn / 12))} Br
          </dd>
        </div>
      </dl>

      {quote.tier ? (
        <p className="mt-4 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-sm text-emerald-800">
          Тариф «{quote.tier.label}» — скидка {Math.round(quote.discount * 100)} %.
          Экономия {byn(quote.savingTiyn)} Br за год.
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-foreground/[0.04] px-3 py-2 text-sm text-foreground/65">
          Корпоративный тариф начинается с {MIN_B2B_SEATS} сотрудников. Для меньшей
          команды выгоднее обычные доступы — напишите, подберём.
        </p>
      )}

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/50">
        {SEAT_TIERS.slice()
          .reverse()
          .map((t) => (
            <li key={t.minSeats}>
              от {t.minSeats} мест — минус {Math.round(t.discount * 100)} %
            </li>
          ))}
      </ul>

      <p className="mt-3 text-xs text-foreground/50">
        {mode === "courses" && chosen.length > 0 && !libraryIsBetter
          ? `В цену входит доступ к выбранным курсам (${chosen.length}) на год, кабинет компании с отчётами и AI-тренажёры для каждого сотрудника.`
          : "В цену входит доступ ко всем курсам библиотеки на год, кабинет компании с отчётами и AI-тренажёры для каждого сотрудника."}
      </p>
    </div>
  );
}
