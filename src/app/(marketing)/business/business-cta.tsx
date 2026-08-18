"use client";

import { useState } from "react";
import { Laptop, Users } from "lucide-react";
import {
  SeatsCalculator,
  type CalculatorCourse,
} from "@/components/landing/seats-calculator";
import { LeadForm } from "@/components/landing/lead-form";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/client";
import { businessContent } from "@/content/business-content";
import type { CurrencyCode } from "@/lib/currency/format";
import type { RatesMap } from "@/lib/currency/rates";

/**
 * Заявка для компании в двух форматах.
 *
 * Онлайн-доступ считается калькулятором: число сотрудников и выбранные курсы
 * уходят в заявку, иначе человек посчитает цену, а потом заново напишет «нас
 * двенадцать, нужны кухни» — и мы потеряем оба параметра сделки.
 *
 * Офлайн-тренинг платформа не продаёт: у него нет ни мест, ни тарифов, поэтому
 * калькулятор скрывается вовсе. Показывать цену там, где она не считается, —
 * значит обещать то, чего в счёте не будет.
 */
export function BusinessCta({
  subscriptionYearTiyn,
  courses,
  currencyCode,
  rates,
}: {
  subscriptionYearTiyn: number;
  courses: CalculatorCourse[];
  /** Валюта страны домена: расчёт показывается в ней (мультидомен, D-013). */
  currencyCode: CurrencyCode;
  rates: RatesMap;
}) {
  const c = businessContent(useLocale()).cta;
  const [format, setFormat] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [seats, setSeats] = useState(10);
  const [courseTitles, setCourseTitles] = useState<string[]>([]);
  // Выбранный тариф уходит в заявку: иначе в уведомлении не видно, считал ли
  // человек библиотеку или пару курсов — и какую сумму он уже держит в голове.
  const [plan, setPlan] = useState<"library" | "courses">("library");
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const isOffline = format === "OFFLINE";

  return (
    // Блок кладётся на тёмный hero, поэтому цвет текста задаём явно: иначе
    // карточки наследуют белый от секции и цифры пропадают на светлом фоне.
    <div className="space-y-4 text-foreground">
      <div
        role="group"
        aria-label={c.format}
        className="inline-flex rounded-xl border border-foreground/12 bg-background p-1 shadow-sm"
      >
        <FormatButton
          active={!isOffline}
          onClick={() => setFormat("ONLINE")}
          icon={<Laptop className="size-4" />}
          label={c.online}
        />
        <FormatButton
          active={isOffline}
          onClick={() => setFormat("OFFLINE")}
          icon={<Users className="size-4" />}
          label={c.offline}
        />
      </div>

      <div
        className={cn(
          "grid gap-5",
          isOffline ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-[1.1fr_1fr]",
        )}
      >
        {isOffline ? (
          <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
            <p className="text-sm font-semibold">{c.offlineTitle}</p>
            <p className="mt-2 text-sm text-foreground/65">
              {c.offlineText}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/75">
              {c.offlinePoints.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-foreground/55">{c.offlinePrice}</p>
          </div>
        ) : (
          <SeatsCalculator
            subscriptionYearTiyn={subscriptionYearTiyn}
            courses={courses}
            currencyCode={currencyCode}
            rates={rates}
            onQuote={(v) => {
              setSeats(v.seats);
              setCourseTitles(v.courseTitles);
              setPlan(v.mode);
              setCourseIds(v.courseIds);
            }}
          />
        )}

        <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
          <p className="text-sm font-semibold">
            {isOffline ? c.offlineRequest : c.onlineRequest}
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            {isOffline ? c.offlineNote : c.onlineNote}
          </p>
          {isOffline ? (
            <LeadForm kind="B2B" format="OFFLINE" className="mt-4" />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

function FormatButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm transition-colors",
        active
          ? "bg-foreground/[0.07] font-medium"
          : "text-foreground/60 hover:text-foreground/85",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
