"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_LABELS } from "@/lib/finance/split";
import { Input } from "@/components/ui/input";

/**
 * Отбор строк журнала доходов: период, страна, покупатель, поиск по компании.
 *
 * Значения живут в адресе страницы, а не в состоянии компонента: отбор можно
 * переслать ссылкой, он переживает обновление страницы, и сводки выше считаются
 * ровно по тому, что видно в таблице. Текущие значения приходят с сервера —
 * так компонент не зависит от useSearchParams и не требует Suspense.
 *
 * Период задаётся ИЛИ годом, ИЛИ датами: выбор одного гасит другое, иначе
 * получилось бы две правды о том, за что показаны цифры.
 */

export interface IncomeFilterValue {
  year: string;
  from: string;
  to: string;
  country: string;
  /** id организации либо «retail» — розничные покупатели. */
  buyer: string;
  q: string;
  /** Параметр визарда предзаполнения: его отбор не трогает. */
  org: string;
}

const selectCls =
  "h-9 rounded-lg border border-foreground/15 bg-background px-2.5 text-sm";

export function IncomeFilters({
  value,
  years,
  buyers,
  hasRetail,
}: {
  value: IncomeFilterValue;
  years: number[];
  buyers: { id: string; name: string }[];
  hasRetail: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(value.q);

  const active =
    Boolean(value.year || value.from || value.to || value.country || value.buyer) ||
    Boolean(value.q);

  function href(next: Partial<IncomeFilterValue>): string {
    const merged = { ...value, ...next };
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(merged)) {
      if (v) params.set(key, v);
    }
    const qs = params.toString();
    return qs ? `/admin/finance?${qs}` : "/admin/finance";
  }

  function apply(next: Partial<IncomeFilterValue>) {
    router.replace(href(next), { scroll: false });
  }

  // Поиск применяем с задержкой: иначе на каждую букву уходит запрос к базе.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current) return;
    const timer = window.setTimeout(() => {
      router.replace(href({ q }), { scroll: false });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <section className="mt-5 rounded-xl border border-foreground/10 bg-background p-3">
      {/* Период: год целиком — одним нажатием, произвольный промежуток — датами. */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <PeriodChip
          onClick={() => apply({ year: "", from: "", to: "" })}
          active={!value.year && !value.from && !value.to}
        >
          Всё время
        </PeriodChip>
        {years.map((y) => (
          <PeriodChip
            key={y}
            onClick={() => apply({ year: String(y), from: "", to: "" })}
            active={value.year === String(y) && !value.from && !value.to}
          >
            {y}
          </PeriodChip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Страна">
          <select
            value={value.country}
            onChange={(e) => apply({ country: e.target.value })}
            className={selectCls}
          >
            <option value="">Все страны</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_FLAGS[c]} {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Покупатель">
          <select
            value={value.buyer}
            onChange={(e) => apply({ buyer: e.target.value })}
            className={`${selectCls} max-w-[220px]`}
          >
            <option value="">Все покупатели</option>
            {hasRetail ? <option value="retail">Частные лица (B2C)</option> : null}
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Оплата с">
          <input
            type="date"
            value={value.from}
            onChange={(e) => apply({ from: e.target.value, year: "" })}
            className={selectCls}
          />
        </Field>
        <Field label="по">
          <input
            type="date"
            value={value.to}
            onChange={(e) => apply({ to: e.target.value, year: "" })}
            className={selectCls}
          />
        </Field>

        <Field label="Поиск компании">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
            <Input
              value={q}
              onChange={(e) => {
                typed.current = true;
                setQ(e.target.value);
              }}
              placeholder="название, счёт, пометка"
              className="h-9 w-56 pl-8"
            />
          </div>
        </Field>

        {active ? (
          <button
            type="button"
            onClick={() => {
              typed.current = false;
              setQ("");
              router.replace(href({ year: "", from: "", to: "", country: "", buyer: "", q: "" }), {
                scroll: false,
              });
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="size-4" />
            Сбросить
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-foreground/50">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function PeriodChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1.5 transition-colors ${
        active
          ? "bg-amber-500/10 font-semibold text-amber-700"
          : "text-foreground/60 hover:bg-foreground/5"
      }`}
    >
      {children}
    </button>
  );
}
