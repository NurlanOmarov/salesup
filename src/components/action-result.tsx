"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Результат действия строкой рядом с кнопкой: «сделано» или «не вышло».
 *
 * Половина действий в админке меняет данные молча — форма остаётся на месте,
 * таблица обновляется где-то выше, и человек не понимает, сработало ли нажатие
 * (владелец выдал лицензию и заметил только сменившуюся надпись на кнопке).
 * Успех гаснет сам через несколько секунд, ошибка висит до следующей попытки:
 * исчезнувшее сообщение об ошибке — это потерянная причина сбоя.
 */

export interface ActionResultValue {
  ok: boolean;
  text: string;
}

const SUCCESS_TTL_MS = 8000;

export function useActionResult() {
  const [result, setResult] = useState<ActionResultValue | null>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Размонтировали форму, пока тикал таймер, — setState в никуда.
  useEffect(() => clearTimer, [clearTimer]);

  const ok = useCallback(
    (text: string) => {
      clearTimer();
      setResult({ ok: true, text });
      timer.current = window.setTimeout(() => setResult(null), SUCCESS_TTL_MS);
    },
    [clearTimer],
  );

  const fail = useCallback(
    (text: string) => {
      clearTimer();
      setResult({ ok: false, text });
    },
    [clearTimer],
  );

  const clear = useCallback(() => {
    clearTimer();
    setResult(null);
  }, [clearTimer]);

  return { result, ok, fail, clear };
}

/**
 * `role="status"` + `aria-live` — чтобы об успехе узнал и тот, кто не видит
 * экран: скринридер прочитает сообщение сам, без перевода фокуса.
 */
export function ActionResult({
  result,
  className = "",
}: {
  result: ActionResultValue | null;
  className?: string;
}) {
  if (!result) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-start gap-1.5 text-sm ${
        result.ok ? "text-emerald-700" : "text-red-600"
      } ${className}`}
    >
      {result.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
      )}
      {result.text}
    </span>
  );
}
