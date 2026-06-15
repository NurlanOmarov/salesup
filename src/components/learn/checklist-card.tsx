"use client";

import { useState } from "react";
import { Check, Square, CheckSquare, RotateCcw } from "lucide-react";
import type { ChecklistData } from "@/lib/interactive";

/**
 * Интерактивный чек-лист подготовки (к звонку/визиту). Локальный прогресс без
 * записи на сервер — лёгкий практический инструмент: отметил пункт → видит прогресс.
 */
export function ChecklistCard({ data }: { data: ChecklistData }) {
  const items = data.items;
  const [done, setDone] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setDone((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const percent = Math.round((done.size / items.length) * 100);
  const allDone = done.size === items.length;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{data.title ?? "Чек-лист подготовки"}</p>
        <span className={`text-sm font-medium ${allDone ? "text-emerald-600" : "text-foreground/55"}`}>
          {done.size}/{items.length}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={`h-full rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {items.map((it, i) => {
          const checked = done.has(i);
          return (
            <li key={i}>
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
              >
                {checked ? (
                  <CheckSquare className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <Square className="mt-0.5 size-5 shrink-0 text-foreground/30" />
                )}
                <span className="min-w-0">
                  <span className={`text-sm ${checked ? "text-foreground/45 line-through" : "text-foreground/85"}`}>
                    {it.text}
                  </span>
                  {it.hint ? <span className="mt-0.5 block text-xs text-foreground/45">{it.hint}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {allDone ? (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-500/[0.08] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Check className="size-4" />
            Готовы к работе — все пункты выполнены!
          </span>
          <button
            onClick={() => setDone(new Set())}
            className="inline-flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Сбросить
          </button>
        </div>
      ) : null}
    </div>
  );
}
