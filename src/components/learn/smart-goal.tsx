"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { SmartGoalData } from "@/lib/interactive";

/**
 * SMART-цель: расплывчатая цель «фокусируется» по мере ответа на 5 критериев —
 * с каждым заполненным критерием собирается кольцо мишени, все 5 → стрела в
 * яблочко. Оболочка без AI-контента и без сохранения (ПДн не собираем).
 */

const CRITERIA: { key: string; letter: string; label: string; hint: string }[] = [
  { key: "s", letter: "S", label: "Конкретная", hint: "Что именно и для чего сделать?" },
  { key: "m", letter: "M", label: "Измеримая", hint: "По какому числу поймёте, что достигли?" },
  { key: "a", letter: "A", label: "Достижимая", hint: "Реально ли с вашими ресурсами?" },
  { key: "r", letter: "R", label: "Значимая", hint: "Зачем это важно именно вам?" },
  { key: "t", letter: "T", label: "Ограниченная по времени", hint: "К какой конкретной дате?" },
];

const RINGS = [82, 64, 46, 28]; // радиусы колец (внешнее → внутреннее), + центр

export function SmartGoal({ data }: { data: SmartGoalData }) {
  const [goal, setGoal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const filled = CRITERIA.filter((c) => (answers[c.key] ?? "").trim().length >= 2).length;
  const done = filled === CRITERIA.length && goal.trim().length >= 2;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
      <h3 className="font-bold">{data.title}</h3>
      <p className="mt-1 text-sm text-foreground/65">{data.prompt}</p>

      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <label className="text-xs font-medium text-foreground/55" htmlFor="smart-goal">
            Ваша цель
          </label>
          <input
            id="smart-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={data.goalPlaceholder ?? "Например: увеличить продажи отдела"}
            className="mb-4 mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />

          <ul className="space-y-2.5">
            {CRITERIA.map((c) => {
              const on = (answers[c.key] ?? "").trim().length >= 2;
              return (
                <li key={c.key} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                      on ? "bg-amber-500 text-white" : "bg-foreground/10 text-foreground/50"
                    }`}
                  >
                    {on ? <Check className="size-3.5" /> : c.letter}
                  </span>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-foreground/70">
                      {c.letter} — {c.label}
                    </div>
                    <input
                      value={answers[c.key] ?? ""}
                      onChange={(e) => setAnswers((p) => ({ ...p, [c.key]: e.target.value }))}
                      placeholder={c.hint}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-sm outline-none focus:border-brand"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Мишень */}
        <div className="flex flex-col items-center gap-2 justify-self-center">
          <svg viewBox="0 0 200 200" className="h-44 w-44" role="img" aria-label="Мишень SMART">
            {RINGS.map((r, i) => {
              const on = i < filled;
              return (
                <motion.circle
                  key={r}
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  strokeWidth="12"
                  className={on ? "stroke-amber-500" : "stroke-foreground/10"}
                  initial={false}
                  animate={{ opacity: on ? 1 : 0.5, scale: on ? 1 : 0.98 }}
                  style={{ transformOrigin: "100px 100px" }}
                />
              );
            })}
            {/* Яблочко */}
            <motion.circle
              cx="100"
              cy="100"
              r="12"
              className={filled >= 4 ? "fill-red-500" : "fill-foreground/15"}
              initial={false}
              animate={{ scale: done ? [1, 1.35, 1] : 1 }}
              transition={{ duration: 0.5 }}
              style={{ transformOrigin: "100px 100px" }}
            />
            {/* Стрела в центр при полной цели */}
            {done ? (
              <motion.g
                initial={{ x: 60, y: -60, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
              >
                <line x1="100" y1="100" x2="150" y2="50" stroke="#111" strokeWidth="3" />
                <polygon points="100,100 108,102 102,108" fill="#111" />
              </motion.g>
            ) : null}
          </svg>
          <span className="text-xs font-semibold text-foreground/50">{filled} / 5 критериев</span>
        </div>
      </div>

      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          🎯 Цель по SMART готова — она конкретная, измеримая и с дедлайном. Такую уже можно взять в работу.
        </motion.div>
      ) : (
        <p className="mt-4 text-xs text-foreground/45">
          Заполните цель и все 5 критериев — мишень соберётся, а стрела попадёт в яблочко.
        </p>
      )}
    </div>
  );
}
