"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { setOrgDemoAction } from "./actions";

/**
 * Демо-доступ прямо в реестре клиентов: видно, кто сидит на ознакомительной
 * части, и процент меняется одним выбором — без захода в карточку каждой
 * компании. Значение применяется ко всем лицензиям клиента (setOrgDemoAction).
 *
 * Здесь селект, а не ползунок из карточки: в таблице важны скорость и
 * одинаковая высота строк, а точная настройка живёт в карточке компании.
 */
const OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Полный доступ" },
  { value: "10", label: "Демо 10%" },
  { value: "20", label: "Демо 20%" },
  { value: "30", label: "Демо 30%" },
  { value: "50", label: "Демо 50%" },
  { value: "0", label: "Закрыт" },
];

export function DemoQuickSelect({
  orgId,
  percent,
  mixed,
  disabled,
}: {
  orgId: string;
  percent: number | null;
  mixed: boolean;
  /** Лицензий нет — менять нечего. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(mixed ? "mixed" : (percent?.toString() ?? ""));

  async function onChange(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      const res = await setOrgDemoAction({
        orgId,
        percent: next === "" ? null : Number(next),
      });
      if (res.ok) router.refresh();
      else {
        setValue(previous);
        setError(res.error);
      }
    } catch {
      setValue(previous);
      setError("Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  if (disabled) {
    return <span className="text-xs text-foreground/40">нет лицензий</span>;
  }

  const isDemo = mixed || percent != null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {isDemo ? <Lock className="size-3.5 shrink-0 text-amber-600" /> : null}
        <select
          value={value}
          disabled={pending}
          onChange={(e) => void onChange(e.target.value)}
          aria-label="Демо-доступ компании"
          className={[
            "rounded-md border px-2 py-1 text-xs transition-colors",
            isDemo
              ? "border-amber-500/40 bg-amber-500/10 font-medium text-amber-800"
              : "border-foreground/15 bg-background text-foreground/70",
          ].join(" ")}
        >
          {mixed ? <option value="mixed">Разные настройки</option> : null}
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
