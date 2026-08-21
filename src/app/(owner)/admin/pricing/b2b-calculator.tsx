"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  MIN_B2B_SEATS,
  quoteSeats,
  SEAT_TIERS,
  SUBSCRIPTION_YEAR_TIYN,
} from "@/lib/pricing";
import { salePrice } from "@/lib/pricing/promo";
import { formatAmount } from "@/lib/pricing/markets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CourseOption {
  id: string;
  title: string;
  priceTiyn: number;
}

/**
 * Калькулятор корпоративного предложения для владельца: число мест и предмет
 * покупки → цена места, годовой чек, скидка. Отсюда же копируется готовая
 * формулировка для счёта и договора, чтобы цифры в переписке и в лицензии
 * совпадали (считает тот же lib/pricing, что и форма выдачи лицензии).
 */
export function B2bCalculator({
  courses,
  trainerTiyn,
}: {
  courses: CourseOption[];
  /** Пакет тренера (300 $) в BYN-копейках: курс считает сервер. */
  trainerTiyn: number;
}) {
  const [seats, setSeats] = useState(10);
  const [subject, setSubject] = useState<"library" | string>("library");
  const [withTrainer, setWithTrainer] = useState(false);
  const [copied, setCopied] = useState(false);

  const course = courses.find((c) => c.id === subject);
  const retailTiyn = subject === "library" ? SUBSCRIPTION_YEAR_TIYN : (course?.priceTiyn ?? 0);
  const quote = quoteSeats(seats, retailTiyn);
  // Тот же порядок слоёв, что и в витринном калькуляторе: места → пакет тренера
  // (фикс на компанию) → акция на всю сумму. Иначе счёт разойдётся с сайтом.
  const fullTotalTiyn = quote.totalTiyn + (withTrainer ? trainerTiyn : 0);
  const sale = salePrice(fullTotalTiyn);
  const perSeatTiyn = Math.round(sale.tiyn / seats);

  const subjectLabel =
    subject === "library"
      ? "годовой доступ ко всем курсам библиотеки"
      : `курс «${course?.title ?? ""}» на год`;

  const wording =
    `${seats} мест — ${subjectLabel}` +
    (withTrainer
      ? ", плюс пакет с тренером: вводная онлайн-сессия (1 ч), итоговая онлайн-сессия (1 ч) и группа сопровождения в мессенджере"
      : "") +
    `. Цена места: ${formatAmount(perSeatTiyn / 100)} BYN в год` +
    (quote.tier ? ` (тариф «${quote.tier.label}», скидка ${Math.round(quote.discount * 100)}%)` : "") +
    (sale.oldTiyn
      ? `. Акция −${sale.percent}%: итого ${formatAmount(sale.tiyn / 100)} BYN вместо ${formatAmount(sale.oldTiyn / 100)} BYN.`
      : `. Итого: ${formatAmount(sale.tiyn / 100)} BYN.`);

  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-sm font-semibold">Расчёт для счёта и договора</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="calc-seats">Мест</Label>
          <Input
            id="calc-seats"
            type="number"
            min={1}
            max={1000}
            value={seats}
            onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-subject">Что покупают</Label>
          <select
            id="calc-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm"
          >
            <option value="library">
              Вся библиотека на год — {formatAmount(SUBSCRIPTION_YEAR_TIYN / 100)} BYN розница
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {formatAmount(c.priceTiyn / 100)} BYN розница
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
        <input
          type="checkbox"
          checked={withTrainer}
          onChange={(e) => setWithTrainer(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          Пакет с тренером: 2 онлайн-сессии (старт и итоги) + группа сопровождения
          <span className="block text-xs text-foreground/55">
            Фиксированные {formatAmount(trainerTiyn / 100)} BYN на компанию (300 $ по курсу
            НБ РК), не зависят от числа мест
          </span>
        </span>
      </label>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Цена места в год"
          value={`${formatAmount(perSeatTiyn / 100)} BYN`}
          hint={sale.oldTiyn ? `без акции ${formatAmount(Math.round(sale.oldTiyn / seats) / 100)} BYN` : undefined}
        />
        <Metric
          label="Итого за год"
          value={`${formatAmount(sale.tiyn / 100)} BYN`}
          hint={sale.oldTiyn ? `без акции ${formatAmount(sale.oldTiyn / 100)} BYN` : undefined}
        />
        <Metric
          label="Скидка"
          value={quote.tier ? `${Math.round(quote.discount * 100)} %` : "нет"}
          hint={quote.tier ? `тариф «${quote.tier.label}»` : `от ${MIN_B2B_SEATS} мест`}
        />
      </dl>

      {quote.tier ? (
        <p className="mt-3 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-sm text-emerald-900">
          Клиент экономит {formatAmount(quote.savingTiyn / 100)} BYN против розницы.
          В пересчёте — {formatAmount(Math.round(quote.pricePerSeatTiyn / 12 / 100))} BYN
          на сотрудника в месяц.
        </p>
      ) : (
        <p className="mt-3 rounded-lg bg-amber-500/[0.07] px-3 py-2 text-sm text-amber-900">
          Меньше {MIN_B2B_SEATS} мест — корпоративная скидка не применяется: сделка не
          окупает переговоры и заведение организации. Такой команде честнее продать
          обычные доступы.
        </p>
      )}

      <div className="mt-4 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
        <p className="text-xs uppercase tracking-wide text-foreground/50">
          Формулировка для счёта
        </p>
        <p className="mt-1 text-sm">{wording}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            void navigator.clipboard.writeText(wording);
            setCopied(true);
          }}
        >
          {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
          Скопировать
        </Button>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground/55">
        {SEAT_TIERS.slice()
          .reverse()
          .map((t) => (
            <li key={t.minSeats}>
              <button
                type="button"
                onClick={() => setSeats(t.minSeats)}
                className="underline-offset-2 hover:underline"
              >
                от {t.minSeats} мест — минус {Math.round(t.discount * 100)} %
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-foreground/50">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-foreground/50">{hint}</p> : null}
    </div>
  );
}
