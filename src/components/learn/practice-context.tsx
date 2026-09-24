"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { PracticeKind } from "@/lib/learn/practice";

/**
 * Мост «тренажёр → урок»: тренажёр сообщает, что пройден (и с каким баллом), а урок
 * записывает это на сервер, отмечает шаг «Тренировка» и показывает награду. Тренажёры
 * ничего не знают об уроке и сервере — вне провайдера хук просто ничего не делает.
 */
type Report = (kind: PracticeKind, scorePct: number | null) => void;

const PracticeContext = createContext<Report | null>(null);

export function PracticeProvider({ onFinish, children }: { onFinish: Report; children: ReactNode }) {
  return <PracticeContext.Provider value={onFinish}>{children}</PracticeContext.Provider>;
}

/**
 * Сообщить о прохождении, когда `done` становится true. Один раз за прогон: после
 * «Заново» (done снова false) следующий финиш отправится опять — копится лучший балл.
 */
export function usePracticeDone(kind: PracticeKind, done: boolean, scorePct?: number | null) {
  const report = useContext(PracticeContext);
  const sent = useRef(false);
  useEffect(() => {
    if (!done) {
      sent.current = false;
      return;
    }
    if (sent.current || !report) return;
    sent.current = true;
    report(kind, scorePct ?? null);
  }, [done, kind, scorePct, report]);
}
