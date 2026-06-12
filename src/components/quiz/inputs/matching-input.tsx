"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { InputProps, ReviewProps } from "../types";

/**
 * MATCHING: сопоставить левый элемент с правым. Под каждым левым — выпадающий выбор
 * из перемешанных правых (question.choices). Ответ = выбранный правый для каждого
 * левого по порядку.
 */
export function MatchingInput({ question, answer, onChange }: InputProps) {
  const choices = question.choices ?? [];
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
          className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-background p-2.5"
        >
          <span className="flex-1 px-1.5 text-sm font-medium">{o.text}</span>
          <ArrowRight className="size-4 shrink-0 text-foreground/30" />
          <select
            value={answer[i] ?? ""}
            onChange={(e) => set(i, e.target.value)}
            className="flex-1 rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">— выберите —</option>
            {choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </motion.div>
      ))}
    </div>
  );
}

export function MatchingReview({ question, answer, review }: ReviewProps) {
  const pairs = review.correctPairs ?? [];
  return (
    <ul className="space-y-1.5 text-sm">
      {question.options.map((o, i) => {
        const userVal = answer[i] ?? "";
        const correct = pairs.find((p) => p.left === o.text)?.right;
        const ok = correct && userVal === correct;
        return (
          <li key={o.id} className="flex flex-wrap items-center gap-2">
            <span className="w-4 shrink-0">{ok ? "✓" : "✗"}</span>
            <span className="font-medium">{o.text}</span>
            <ArrowRight className="size-3.5 text-foreground/30" />
            <span className={ok ? "text-emerald-700" : "text-red-600"}>{userVal || "—"}</span>
            {!ok && correct ? <span className="text-xs text-emerald-700">(верно: {correct})</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
