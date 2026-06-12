"use client";

import { motion } from "framer-motion";
import { Stethoscope, MessageSquare } from "lucide-react";
import type { InputProps, ReviewProps } from "../types";

/**
 * SCENARIO: диалог с врачом. Реплика «клиента» (question.text — её показывает раннер)
 * → ученик выбирает лучший ответ из вариантов (оформлены как реплики медпреда).
 * Оценка — как один верный вариант (SINGLE_CHOICE), разбор поясняет почему.
 */
export function ScenarioInput({ question, answer, onChange }: InputProps) {
  const selected = answer[0];
  return (
    <div className="space-y-3">
      {/* Реплика врача */}
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
          <Stethoscope className="size-4" />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-foreground/[0.05] px-4 py-2.5 text-sm">
          Врач реагирует. Выберите лучший ответ медпредставителя:
        </div>
      </div>

      <p className="px-1 text-xs font-medium text-foreground/50">Варианты вашего ответа:</p>
      <div className="space-y-2">
        {question.options.map((o, i) => {
          const active = selected === o.id;
          return (
            <motion.button
              key={o.id}
              type="button"
              data-quiz-option
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onChange([o.id])}
              className={[
                "flex w-full items-start gap-2.5 rounded-2xl rounded-tr-sm border px-4 py-3 text-left text-sm transition-colors",
                active ? "border-amber-500 bg-amber-500/[0.07]" : "border-foreground/15 hover:border-foreground/30",
              ].join(" ")}
            >
              <MessageSquare className={`mt-0.5 size-4 shrink-0 ${active ? "text-amber-600" : "text-foreground/30"}`} />
              <span>{o.text}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/** Разбор SCENARIO: какой ответ лучший. */
export function ScenarioReview({ question, answer, review }: ReviewProps) {
  const correct = new Set(review.correctOptionIds);
  const selected = answer[0];
  return (
    <ul className="space-y-1.5 text-sm">
      {question.options.map((o) => {
        const isCorrect = correct.has(o.id);
        const isSelected = selected === o.id;
        return (
          <li
            key={o.id}
            className={[
              "flex items-start gap-2",
              isCorrect ? "font-medium text-emerald-700" : isSelected ? "text-red-600" : "text-foreground/50",
            ].join(" ")}
          >
            <span className="w-4 shrink-0">{isCorrect ? "✓" : isSelected ? "✗" : "•"}</span>
            <span>{o.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
