"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { DEVICE_FLAG_FROM, DEVICE_LIMIT } from "@/lib/antishare/limits";
import { Button } from "@/components/ui/button";

/**
 * Настройка лимита устройств — одна и та же и для розничного ученика, и для
 * корпоративного клиента (там она действует на всех работников сразу).
 * Компонент презентационный: сохранение и сброс делает вызывающая сторона
 * своим Server Action, здесь только выбор режима и состояние кнопок.
 */

export type DeviceLimitMode = "default" | "unlimited" | "custom";

/** Разложить сохранённое значение (null | 0 | N) на режим и число. */
export function deviceLimitMode(value: number | null): DeviceLimitMode {
  if (value === null) return "default";
  return value <= 0 ? "unlimited" : "custom";
}

export function DeviceLimitForm({
  value,
  onSave,
  onReset,
  defaultLabel = `Стандарт (${DEVICE_LIMIT})`,
  defaultHint = "Лимит по умолчанию",
  description,
  inheritedNote,
  resetTitle,
  resetDescription,
  resetLabel = "Сбросить устройства",
}: {
  /** Текущее значение: null — наследовать, 0 — безлимит, N — столько устройств. */
  value: number | null;
  onSave: (mode: DeviceLimitMode, limit: number) => Promise<{ ok: boolean; error?: string }>;
  /** Забыть все запомненные устройства. Возвращает, сколько записей стёрлось. */
  onReset?: () => Promise<{ ok: boolean; error?: string; cleared?: number }>;
  defaultLabel?: string;
  defaultHint?: string;
  description: React.ReactNode;
  /** Что действует сейчас, если своя настройка не задана (лимит организации). */
  inheritedNote?: React.ReactNode;
  resetTitle?: string;
  resetDescription?: React.ReactNode;
  resetLabel?: string;
}) {
  const [mode, setMode] = useState<DeviceLimitMode>(deviceLimitMode(value));
  const [limit, setLimit] = useState<number>(value && value > 0 ? value : DEVICE_LIMIT);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetPending, startReset] = useTransition();
  const [cleared, setCleared] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const options: { value: DeviceLimitMode; label: string; hint: string }[] = [
    { value: "default", label: defaultLabel, hint: defaultHint },
    { value: "custom", label: "Своё число", hint: "Точное число устройств" },
    { value: "unlimited", label: "Безлимит", hint: "Без ограничения" },
  ];

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <h2 className="font-semibold">Лимит устройств</h2>
      <p className="mt-0.5 text-sm text-foreground/55">{description}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              setMode(o.value);
              setSaved(false);
              setError(null);
            }}
            className={[
              "rounded-xl border p-3 text-left transition-colors",
              mode === o.value
                ? "border-amber-500/50 bg-amber-500/[0.07]"
                : "border-foreground/15 hover:bg-foreground/[0.03]",
            ].join(" ")}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="mt-0.5 block text-xs text-foreground/50">{o.hint}</span>
          </button>
        ))}
      </div>

      {mode === "default" && inheritedNote ? (
        <p className="mt-3 text-sm text-foreground/60">{inheritedNote}</p>
      ) : null}

      {mode === "custom" ? (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="device-limit" className="text-sm text-foreground/60">
            Устройств:
          </label>
          <input
            id="device-limit"
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => {
              setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)));
              setSaved(false);
            }}
            className="h-10 w-24 rounded-lg border border-foreground/20 bg-background px-3 text-sm"
          />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await onSave(mode, limit);
              if (res.ok) setSaved(true);
              else setError(res.error ?? "Не удалось сохранить");
            })
          }
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" /> Сохранено
          </span>
        ) : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>

      {onReset ? (
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <p className="text-sm font-medium">{resetTitle ?? "Забыть устройства"}</p>
          <p className="mt-0.5 text-sm text-foreground/55">{resetDescription}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {confirmReset ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resetPending}
                  onClick={() =>
                    startReset(async () => {
                      setError(null);
                      const res = await onReset();
                      setConfirmReset(false);
                      if (res.ok) setCleared(res.cleared ?? 0);
                      else setError(res.error ?? "Не удалось сбросить");
                    })
                  }
                >
                  {resetPending ? "Стираем…" : "Да, стереть"}
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-sm text-foreground/55 hover:text-foreground"
                >
                  Отмена
                </button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={resetPending}
                onClick={() => {
                  setCleared(null);
                  setConfirmReset(true);
                }}
              >
                <RotateCcw className="size-4" />
                {resetLabel}
              </Button>
            )}
            {cleared !== null ? (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <Check className="size-4" />
                {cleared === 0 ? "Записей не было" : `Стёрто устройств: ${cleared}`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Общий хвост описания: с какого числа устройств учётка попадает в «Сигналы». */
export const DEVICE_FLAG_NOTE = `Если лимит поднят вручную, с ${DEVICE_FLAG_FROM} устройств учётка появляется в «Сигналах».`;
