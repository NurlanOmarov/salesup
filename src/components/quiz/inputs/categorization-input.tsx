"use client";

import { motion } from "framer-motion";
import type { InputProps, ReviewProps } from "../types";

/**
 * CATEGORIZATION: распределить элементы по категориям. Под каждым элементом —
 * сегмент-кнопки категорий (question.choices). Ответ = выбранная категория для
 * каждого элемента по порядку.
 */
export function CategorizationInput({ question, answer, onChange }: InputProps) {
  const categories = question.choices ?? [];
  const set = (i: number, v: string) => {
    const next = [...answer];
    while (next.length < question.options.length) next.push("");
    next[i] = v;
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      {question.options.map((o, i) => (
        <motion.div
          key={o.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-foreground/15 bg-background p-2.5"
        >
          <span className="px-1.5 text-sm font-medium">{o.text}</span>
          <div className="flex gap-1 rounded-lg bg-foreground/[0.04] p-0.5">
            {categories.map((c) => {
              const active = answer[i] === c;
              return (
                <button
                  key={c}
                  type="button"
                  data-quiz-category
                  onClick={() => set(i, c)}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-amber-500 text-slate-950" : "text-foreground/60 hover:text-foreground",
                  ].join(" ")}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function CategorizationReview({ question, answer, review }: ReviewProps) {
  const correctCats = review.correctPairs ?? [];
  return (
    <ul className="space-y-1.5 text-sm">
      {question.options.map((o, i) => {
        const userVal = answer[i] ?? "";
        const correct = correctCats.find((p) => p.left === o.text)?.right;
        const ok = correct && userVal === correct;
        return (
          <li key={o.id} className="flex items-center gap-2">
            <span className="w-4 shrink-0">{ok ? "✓" : "✗"}</span>
            <span className="font-medium">{o.text}</span>
            <span className="text-foreground/50">→</span>
            <span className={ok ? "text-emerald-700" : "text-red-600"}>{userVal || "—"}</span>
            {!ok && correct ? <span className="text-xs text-emerald-700">(верно: {correct})</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
