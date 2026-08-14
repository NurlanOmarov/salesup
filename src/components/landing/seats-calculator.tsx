"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { MIN_B2B_SEATS, quoteSeats, SEAT_TIERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Калькулятор корпоративного доступа: ввёл число сотрудников — увидел цену места
 * и годовой чек. Считает по той же сетке, что и админка (lib/pricing), поэтому
 * цифра на лендинге и цифра в счёте не могут разойтись.
 *
 * Смысл в конверсии: закупщику не нужно писать «пришлите прайс» — он сразу
 * видит порядок суммы и решает, стоит ли разговор.
 */
export function SeatsCalculator({
  subscriptionYearTiyn,
  onQuote,
}: {
  subscriptionYearTiyn: number;
  /** Прокидываем выбранное число мест в форму заявки. */
  onQuote?: (seats: number) => void;
}) {
  const [seats, setSeats] = useState(10);
  const quote = quoteSeats(seats, subscriptionYearTiyn);

  function change(next: number) {
    const clamped = Math.max(1, Math.min(500, next));
    setSeats(clamped);
    onQuote?.(clamped);
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
        В цену входит доступ ко всем курсам библиотеки на год, кабинет компании с
        отчётами и AI-тренажёры для каждого сотрудника.
      </p>
    </div>
  );
}
