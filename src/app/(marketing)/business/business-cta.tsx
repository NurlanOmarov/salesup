"use client";

import { useState } from "react";
import {
  SeatsCalculator,
  type CalculatorCourse,
} from "@/components/landing/seats-calculator";
import { LeadForm } from "@/components/landing/lead-form";

/**
 * Калькулятор и форма рядом: число сотрудников и выбранные курсы подставляются
 * в заявку. Иначе человек считает цену, а потом заново пишет «нас двенадцать,
 * нужны кухни» — и мы теряем оба параметра сделки.
 */
export function BusinessCta({
  subscriptionYearTiyn,
  courses,
}: {
  subscriptionYearTiyn: number;
  courses: CalculatorCourse[];
}) {
  const [seats, setSeats] = useState(10);
  const [courseTitles, setCourseTitles] = useState<string[]>([]);
  // Выбранный тариф уходит в заявку: иначе в уведомлении не видно, считал ли
  // человек библиотеку или пару курсов — и какую сумму он уже держит в голове.
  const [plan, setPlan] = useState<"library" | "courses">("library");
  const [courseIds, setCourseIds] = useState<string[]>([]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <SeatsCalculator
        subscriptionYearTiyn={subscriptionYearTiyn}
        courses={courses}
        onQuote={(v) => {
          setSeats(v.seats);
          setCourseTitles(v.courseTitles);
          setPlan(v.mode);
          setCourseIds(v.courseIds);
        }}
      />
      <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
        <p className="text-sm font-semibold">Получить расчёт и счёт</p>
        <p className="mt-1 text-sm text-foreground/60">
          Ответим в рабочее время, посчитаем точную стоимость и пришлём счёт.
        </p>
        <LeadForm
          kind="B2B"
          defaultSeats={seats}
          plan={plan === "courses" ? "COURSES" : "LIBRARY"}
          planCourseIds={courseIds}
          defaultMessage={
            courseTitles.length > 0
              ? `Интересуют курсы: ${courseTitles.join(", ")}`
              : undefined
          }
          className="mt-4"
        />
      </div>
    </div>
  );
}
