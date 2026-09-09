"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionResult, useActionResult } from "@/components/action-result";

/**
 * Ползунок демо-доступа: сколько процентов курса открыто клиенту до оплаты.
 *
 * Хранится процент, но подпись всегда переводит его в уроки («30% — 9 из 33»):
 * процент один на все курсы, а решение владелец принимает всё-таки в уроках.
 * Пересчёт — тот же, что в lib/access.demoLessonCount (floor, минимум один урок),
 * иначе админка обещала бы не то, что увидит ученик.
 */
export function demoLessonCountUi(totalLessons: number, percent: number): number {
  if (totalLessons <= 0) return 0;
  const p = Math.min(100, Math.max(0, percent));
  if (p <= 0) return 0;
  if (p >= 100) return totalLessons;
  return Math.max(1, Math.floor((totalLessons * p) / 100));
}

const PRESETS = [10, 20, 30, 50];

export function DemoAccessSlider({
  percent,
  lessonsTotal,
  save,
  hint,
}: {
  /** Текущее значение: null — полный доступ. */
  percent: number | null;
  lessonsTotal: number;
  /** Сохранение: server action конкретного уровня (лицензия / доступ / вся компания). */
  save: (percent: number | null) => Promise<{ ok: boolean; error?: string }>;
  hint?: string;
}) {
  const router = useRouter();
  const feedback = useActionResult();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState(percent ?? 30);
  const [enabled, setEnabled] = useState(percent != null);

  const open = demoLessonCountUi(lessonsTotal, value);
  const dirty = enabled ? percent !== value : percent !== null;

  async function submit(nextPercent: number | null) {
    setPending(true);
    feedback.clear();
    try {
      const res = await save(nextPercent);
      if (res.ok) {
        feedback.ok(
          nextPercent == null
            ? "Курс открыт полностью."
            : `Демо-доступ: ${nextPercent}% — ${demoLessonCountUi(lessonsTotal, nextPercent)} из ${lessonsTotal} уроков.`,
        );
        router.refresh();
      } else {
        feedback.fail(res.error ?? "Не удалось сохранить");
      }
    } catch {
      feedback.fail("Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-amber-500"
          />
          {enabled ? <Lock className="size-4 text-amber-600" /> : <Unlock className="size-4 text-emerald-600" />}
          Демо-доступ
        </label>
        <span className="text-xs text-foreground/55">
          {enabled
            ? `${value}% — ${open} из ${lessonsTotal} ${lessonsTotal === 1 ? "урока" : "уроков"}`
            : "открыт весь курс"}
        </span>
      </div>

      {enabled ? (
        <>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="mt-3 w-full accent-amber-500"
            aria-label="Процент открытого материала"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setValue(p)}
                className={[
                  "rounded-md border px-2 py-0.5 text-xs transition-colors",
                  value === p
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-800"
                    : "border-foreground/15 text-foreground/60 hover:bg-foreground/5",
                ].join(" ")}
              >
                {p}%
              </button>
            ))}
          </div>
        </>
      ) : null}

      {hint ? <p className="mt-2 text-xs text-foreground/50">{hint}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={pending || !dirty}
          onClick={() => submit(enabled ? value : null)}
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
        {percent != null ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setEnabled(false);
              void submit(null);
            }}
          >
            Открыть полностью
          </Button>
        ) : null}
      </div>

      <ActionResult result={feedback.result} className="mt-2" />
    </div>
  );
}
