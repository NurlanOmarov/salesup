"use client";

import { motion } from "framer-motion";
import { Check, Target } from "lucide-react";
import type { DailyQuest } from "@/lib/gamification/quests";

/**
 * Панель ежедневных целей (Daily Quests): дробные задачи дня с прогрессом.
 * Мотивирует «закрыть тройку» и вернуться завтра. Данные считаются на сервере.
 */
export function DailyQuests({ quests }: { quests: DailyQuest[] }) {
  const done = quests.filter((q) => q.done).length;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Target className="size-4 text-amber-600" />
          Цели дня
        </p>
        <span className="text-sm text-foreground/55">
          {done}/{quests.length}
        </span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {quests.map((q) => {
          const pct = q.target > 0 ? Math.round((q.current / q.target) * 100) : 0;
          return (
            <li key={q.key} className="flex items-center gap-3">
              <span
                className={[
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  q.done
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
                    : "border-foreground/20 text-transparent",
                ].join(" ")}
              >
                <Check className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={q.done ? "text-foreground/50 line-through" : "text-foreground/85"}>
                    {q.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-foreground/45">
                    {q.current}/{q.target}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <motion.div
                    className={`h-full rounded-full ${q.done ? "bg-emerald-500" : "bg-amber-500"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
