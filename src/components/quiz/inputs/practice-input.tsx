"use client";

import { CheckSquare } from "lucide-react";
import type { InputProps, ReviewProps } from "../types";

/**
 * PRACTICE: упражнение «составьте сами» (тренер прямо в ролике даёт задание).
 * Свободный ввод; автопроверки нет — зачёт за содержательную попытку. Критерии
 * (question.options) показываются как ориентир; эталон раскрывается в разборе.
 */
export function PracticeInput({ question, answer, onChange }: InputProps) {
  return (
    <div className="space-y-3">
      <textarea
        value={answer[0] ?? ""}
        onChange={(e) => onChange([e.target.value])}
        rows={6}
        placeholder="Напишите свой вариант…"
        className="w-full resize-y rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-amber-500"
      />
      {question.options.length > 0 ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            Учтите при выполнении
          </p>
          <ul className="mt-2 space-y-1">
            {question.options.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-sm text-foreground/70">
                <CheckSquare className="mt-0.5 size-4 shrink-0 text-amber-600/70" />
                {o.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Разбор PRACTICE: ответ ученика + эталон (explanation) для самопроверки. */
export function PracticeReview({ answer, review }: ReviewProps) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Ваш ответ</p>
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-foreground/[0.03] px-3 py-2 text-foreground/80">
          {answer[0]?.trim() || "—"}
        </p>
      </div>
      {review.explanation ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Эталон для сверки</p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2 text-foreground/80">
            {review.explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}
