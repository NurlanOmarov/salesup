"use client";

import { useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import type { InputProps, ReviewProps, QuizOption } from "../types";

/**
 * ORDERING: расставить варианты в правильном порядке перетаскиванием (Framer Motion
 * Reorder — плавная анимация перестановки, layout animation). Ответ = массив id
 * в текущем порядке; при первом показе порядок = как пришёл (перемешан на сервере).
 */
export function OrderingInput({ question, answer, onChange }: InputProps) {
  // answer хранит порядок id; инициализируем порядком опций, если пусто
  const order = answer.length === question.options.length ? answer : question.options.map((o) => o.id);
  useEffect(() => {
    if (answer.length !== question.options.length) onChange(question.options.map((o) => o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = new Map(question.options.map((o) => [o.id, o]));
  const items = order.map((id) => byId.get(id)).filter(Boolean) as QuizOption[];

  return (
    <Reorder.Group axis="y" values={order} onReorder={onChange} className="space-y-2.5">
      {items.map((o, i) => (
        <OrderingRow key={o.id} option={o} index={i} />
      ))}
    </Reorder.Group>
  );
}

function OrderingRow({ option, index }: { option: QuizOption; index: number }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={option.id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
      className="flex items-center gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-3 select-none"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-700">
        {index + 1}
      </span>
      <span className="flex-1">{option.text}</span>
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none text-foreground/30 transition-colors hover:text-foreground/60 active:cursor-grabbing"
        aria-label="Перетащить"
      >
        <GripVertical className="size-5" />
      </button>
    </Reorder.Item>
  );
}

/** Разбор ORDERING: показываем правильный порядок. */
export function OrderingReview({ question, answer, review }: ReviewProps) {
  const byId = new Map(question.options.map((o) => [o.id, o]));
  const correctOrder = review.correctOptionIds;
  return (
    <ol className="space-y-1.5 text-sm">
      {correctOrder.map((id, i) => {
        const userCorrect = answer[i] === id;
        return (
          <li key={id} className="flex items-center gap-2">
            <span className="w-4 shrink-0 font-medium text-emerald-700">{i + 1}.</span>
            <span className="font-medium text-emerald-700">{byId.get(id)?.text}</span>
            {!userCorrect ? <span className="text-xs text-red-500">(у вас было иначе)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
