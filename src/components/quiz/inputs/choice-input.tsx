"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { InputProps } from "../types";

/** Ввод для SINGLE_CHOICE / TRUE_FALSE / MULTI_CHOICE. */
export function ChoiceInput({ question, answer, onChange }: InputProps) {
  const multi = question.type === "MULTI_CHOICE";
  const selected = new Set(answer);

  const toggle = (id: string) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next]);
    } else {
      onChange([id]);
    }
  };

  return (
    <div className="space-y-2.5">
      {question.options.map((o, i) => {
        const checked = selected.has(o.id);
        return (
          <motion.button
            key={o.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => toggle(o.id)}
            className={[
              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
              checked
                ? "border-amber-500 bg-amber-500/[0.07]"
                : "border-foreground/15 hover:border-foreground/30 hover:bg-foreground/[0.02]",
            ].join(" ")}
          >
            <span
              className={[
                "flex size-5 shrink-0 items-center justify-center border transition-colors",
                multi ? "rounded-md" : "rounded-full",
                checked ? "border-amber-500 bg-amber-500 text-slate-950" : "border-foreground/30",
              ].join(" ")}
            >
              {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span>{o.text}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Разбор для choice-типов. */
export function ChoiceReview({ question, answer, review }: import("../types").ReviewProps) {
  const selected = new Set(answer);
  const correct = new Set(review.correctOptionIds);
  return (
    <ul className="space-y-1.5 text-sm">
      {question.options.map((o) => {
        const isCorrect = correct.has(o.id);
        const isSelected = selected.has(o.id);
        return (
          <li
            key={o.id}
            className={[
              "flex items-center gap-2",
              isCorrect ? "font-medium text-emerald-700" : isSelected ? "text-red-600" : "text-foreground/50",
            ].join(" ")}
          >
            <span className="w-4 shrink-0">{isCorrect ? "✓" : isSelected ? "✗" : "•"}</span>
            <span className={isSelected && !isCorrect ? "line-through" : ""}>{o.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
