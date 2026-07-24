"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, GitCompareArrows, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Управление периодом дашборда: быстрые пресеты, точный выбор дат (range-календарь)
 * и сравнение с предыдущим периодом. Состояние держим в URL (?range/from/to/compare),
 * чтобы страница-RSC перечитывала данные и период шарился ссылкой.
 */

const PRESETS = [
  { key: "7", label: "7 дней" },
  { key: "30", label: "30 дней" },
  { key: "90", label: "90 дней" },
  { key: "all", label: "Всё время" },
] as const;

export function PeriodControls({
  activeRange,
  from,
  to,
  compare,
}: {
  activeRange: string;
  from: string;
  to: string;
  compare: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: new Date(from),
    to: new Date(to),
  });

  function push(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  function selectPreset(key: string) {
    push({ range: key, from: null, to: null });
  }

  function applyCustom() {
    if (!draft?.from || !draft?.to) return;
    push({
      range: "custom",
      from: format(draft.from, "yyyy-MM-dd"),
      to: format(draft.to, "yyyy-MM-dd"),
    });
    setOpen(false);
  }

  function toggleCompare() {
    push({ compare: compare ? null : "1" });
  }

  const isCustom = activeRange === "custom";
  const rangeLabel =
    format(new Date(from), "d MMM yyyy", { locale: ru }) +
    " — " +
    format(new Date(to), "d MMM yyyy", { locale: ru });

  return (
    <div className={cn("flex flex-wrap items-center gap-2", isPending && "opacity-70")}>
      {/* Пресеты */}
      <div className="inline-flex rounded-lg border border-foreground/10 bg-background p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeRange === p.key
                ? "bg-brand text-white"
                : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Точный диапазон */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              isCustom
                ? "border-brand/40 bg-brand/5 text-foreground"
                : "border-foreground/10 bg-background text-foreground/60 hover:text-foreground",
            )}
          >
            <CalendarDays className="size-4" />
            {isCustom ? rangeLabel : "Свой период"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={2}
            defaultMonth={draft?.from}
          />
          <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2">
            <span className="text-xs text-foreground/50">
              {draft?.from && draft?.to
                ? `${format(draft.from, "d MMM", { locale: ru })} — ${format(draft.to, "d MMM", { locale: ru })}`
                : "Выберите начало и конец"}
            </span>
            <Button size="sm" variant="brand" onClick={applyCustom} disabled={!draft?.from || !draft?.to}>
              <Check className="size-4" />
              Применить
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Сравнение с предыдущим периодом */}
      <button
        onClick={toggleCompare}
        aria-pressed={compare}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          compare
            ? "border-brand/40 bg-brand/5 text-foreground"
            : "border-foreground/10 bg-background text-foreground/60 hover:text-foreground",
        )}
      >
        <GitCompareArrows className="size-4" />
        Сравнить с прошлым
      </button>
    </div>
  );
}
