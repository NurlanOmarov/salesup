"use client";

import { motion } from "framer-motion";
import type { InputProps, ReviewProps } from "../types";

/**
 * FILL_BLANK: вписать пропущенные слова. Вопрос содержит «___» для каждого пропуска;
 * порядок инпутов соответствует порядку пропусков (option.sortOrder). option.text —
 * подсказка-плейсхолдер. Ответ = массив введённых строк по порядку.
 */
export function FillBlankInput({ question, answer, onChange }: InputProps) {
  const set = (i: number, v: string) => {
    const next = [...answer];
    while (next.length < question.options.length) next.push("");
    next[i] = v;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {question.options.map((o, i) => (
        <motion.div
          key={o.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-700">
            {i + 1}
          </span>
          <input
            value={answer[i] ?? ""}
            onChange={(e) => set(i, e.target.value)}
            placeholder={o.text || "Введите ответ…"}
            className="flex-1 rounded-xl border border-foreground/15 bg-background px-4 py-3 outline-none transition-colors focus:border-amber-500"
          />
        </motion.div>
      ))}
    </div>
  );
}

/** Разбор FILL_BLANK: эталонные ответы и что ввёл ученик. */
export function FillBlankReview({ answer, review }: ReviewProps) {
  const correct = review.correctTexts ?? [];
  return (
    <ul className="space-y-1.5 text-sm">
      {correct.map((text, i) => {
        const userVal = answer[i] ?? "";
        const ok = userVal.trim().toLowerCase().replace(/ё/g, "е") === text.trim().toLowerCase().replace(/ё/g, "е");
        return (
          <li key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 font-medium text-emerald-700">{ok ? "✓" : "✗"}</span>
            <span className="font-medium text-emerald-700">{text}</span>
            {!ok && userVal ? <span className="text-xs text-red-500">(вы: «{userVal}»)</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
