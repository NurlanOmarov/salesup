"use client";

import { useState } from "react";
import { SeatsCalculator } from "@/components/landing/seats-calculator";
import { LeadForm } from "@/components/landing/lead-form";

/**
 * Калькулятор и форма рядом: число сотрудников, выбранное в калькуляторе,
 * подставляется в заявку. Иначе человек считает цену, а потом заново пишет
 * «нас двенадцать» — и мы теряем самый важный параметр сделки.
 */
export function BusinessCta({
  subscriptionYearTiyn,
}: {
  subscriptionYearTiyn: number;
}) {
  const [seats, setSeats] = useState(10);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <SeatsCalculator
        subscriptionYearTiyn={subscriptionYearTiyn}
        onQuote={setSeats}
      />
      <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
        <p className="text-sm font-semibold">Получить расчёт и счёт</p>
        <p className="mt-1 text-sm text-foreground/60">
          Ответим в рабочее время, посчитаем точную стоимость и пришлём счёт.
        </p>
        <LeadForm kind="B2B" defaultSeats={seats} className="mt-4" />
      </div>
    </div>
  );
}
