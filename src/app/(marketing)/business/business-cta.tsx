"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Laptop, Users } from "lucide-react";
import {
  SeatsCalculator,
  type CalculatorCourse,
} from "@/components/landing/seats-calculator";
import { LeadForm } from "@/components/landing/lead-form";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/client";
import { businessContent } from "@/content/business-content";
import { formatCurrency, type CurrencyCode } from "@/lib/currency/format";
import type { RatesMap } from "@/lib/currency/rates";

/**
 * Заявка для компании в двух форматах.
 *
 * Онлайн-доступ считается калькулятором: число сотрудников и набор курсов
 * уходят в заявку, иначе человек посчитает цену, а потом заново напишет «нас
 * двенадцать, нужны кухни» — и мы потеряем оба параметра сделки.
 *
 * Офлайн-тренинг платформа не продаёт: у него нет ни мест, ни тарифов, поэтому
 * калькулятор скрывается вовсе. Показывать цену там, где она не считается, —
 * значит обещать то, чего в счёте не будет.
 *
 * На телефоне онлайн-расчёт — мастер из четырёх шагов (команда → курсы →
 * пакет → контакт): одной лентой калькулятор с формой занимали пять экранов, и
 * до кнопки заявки не долистывали. Снизу закреплена полоска с итогом и кнопкой
 * «Далее» — сумма видна на каждом шаге, а не только на третьем. На десктопе
 * всё видно разом, шаги ни на что не влияют.
 */
const STEPS = 4;
export function BusinessCta({
  fallbackRetailTiyn,
  courses,
  currencyCode,
  rates,
}: {
  /** База расчёта, когда каталог недоступен (пререндер без БД). */
  fallbackRetailTiyn: number;
  courses: CalculatorCourse[];
  /** Валюта страны домена: расчёт показывается в ней (мультидомен, D-013). */
  currencyCode: CurrencyCode;
  rates: RatesMap;
}) {
  const locale = useLocale();
  const c = businessContent(locale).cta;
  const [format, setFormat] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [seats, setSeats] = useState(10);
  const [courseTitles, setCourseTitles] = useState<string[]>([]);
  // Состав набора уходит в заявку: иначе в уведомлении не видно, что именно
  // человек считал, — и какую сумму он уже держит в голове.
  const [courseIds, setCourseIds] = useState<string[]>([]);
  // Пакет с живыми сессиями тренера: в заявке он меняет и состав, и сумму.
  const [withTrainer, setWithTrainer] = useState(false);

  const [step, setStep] = useState(1);
  const [totals, setTotals] = useState<{ totalTiyn: number; perSeatTiyn: number } | null>(null);
  // Полоска живёт только пока блок расчёта на экране: на остальной странице
  // она заслоняла бы контент и продавала бы то, чего человек сейчас не видит.
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const money = (tiyn: number) => formatCurrency(tiyn, currencyCode, rates, locale);
  const w = c.wizard;

  function goTo(next: number) {
    setStep(Math.max(1, Math.min(STEPS, next)));
    // Новый шаг начинается сверху блока — иначе после длинного списка курсов
    // человек оказывается посреди пустоты под коротким следующим шагом.
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const isOffline = format === "OFFLINE";
  const wizard = !isOffline;

  return (
    // Блок кладётся на тёмный hero, поэтому цвет текста задаём явно: иначе
    // карточки наследуют белый от секции и цифры пропадают на светлом фоне.
    <div
      ref={rootRef}
      className={cn("scroll-mt-20 space-y-4 text-foreground", wizard && "max-lg:pb-20")}
    >
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

      {wizard ? (
        <nav aria-label={w.stepOf(step, STEPS)} className="lg:hidden">
          <p className="text-xs text-foreground/55">
            {w.stepOf(step, STEPS)} · <span className="font-semibold text-foreground">{w.steps[step - 1]}</span>
          </p>
          {/* Пройденные шаги кликабельны: вернуться поправить число людей не
              должно означать «Назад» три раза. Будущие — нет, их ещё не видели. */}
          <ol className="mt-2 grid grid-cols-4 gap-1.5">
            {w.steps.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={i + 1 > step}
                  onClick={() => goTo(i + 1)}
                  aria-current={i + 1 === step ? "step" : undefined}
                  aria-label={label}
                  className={cn(
                    "block h-1.5 w-full rounded-full transition-colors",
                    i + 1 <= step ? "bg-brand" : "bg-foreground/10",
                  )}
                />
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div
        className={cn(
          "grid gap-5 lg:items-start [&>*]:min-w-0",
          isOffline ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-[1.35fr_1fr]",
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
          <div className={cn(step === STEPS && "max-lg:hidden")}>
          <SeatsCalculator
            step={step}
            onTotals={setTotals}
            fallbackRetailTiyn={fallbackRetailTiyn}
            courses={courses}
            currencyCode={currencyCode}
            rates={rates}
            onQuote={(v) => {
              setSeats(v.seats);
              setCourseTitles(v.courseTitles);
              setCourseIds(v.courseIds);
              setWithTrainer(v.withTrainer);
            }}
          />
          </div>
        )}

        {/* Калькулятор длинный — форма едет рядом, чтобы после выбора курсов
            не пришлось листать обратно наверх. */}
        <div
          className={cn(
            "rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6 lg:sticky lg:top-24",
            wizard && step !== STEPS && "max-lg:hidden",
          )}
        >
          {wizard ? (
            <button
              type="button"
              onClick={() => goTo(STEPS - 1)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="size-4" />
              {w.back}
            </button>
          ) : null}
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
              seatsFromCalculator
              planCourseIds={courseIds}
              withTrainer={withTrainer}
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

      {wizard && inView && step < STEPS ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
                aria-label={w.back}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-foreground/15"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {totals ? (
                <>
                  <p className="truncate text-base font-bold tabular-nums">
                    {money(totals.totalTiyn)}{" "}
                    <span className="text-xs font-normal text-foreground/55">{w.forTeam}</span>
                  </p>
                  <p className="truncate text-xs text-foreground/55 tabular-nums">
                    {money(totals.perSeatTiyn)} {w.perSeat}
                  </p>
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
            >
              {step === STEPS - 1 ? w.toContact : w.next}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
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
