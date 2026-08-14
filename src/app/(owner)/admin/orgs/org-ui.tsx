import { cn } from "@/lib/utils";

/** Мелкие презентационные детали, общие для списка организаций и карточки клиента. */

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активна",
  SUSPENDED: "Приостановлена",
  ARCHIVED: "В архиве",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700",
  SUSPENDED: "bg-amber-500/10 text-amber-700",
  ARCHIVED: "bg-foreground/10 text-foreground/60",
};

export function OrgStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        STATUS_STYLES[status] ?? STATUS_STYLES.ARCHIVED,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/**
 * Занятость мест. Цвет — сигнал владельцу: пустая лицензия (клиент купил и не
 * пользуется) грозит непродлением так же, как и полностью занятая — недопродажей.
 */
export function SeatsBar({ used, total }: { used: number; total: number }) {
  if (total === 0) {
    return <span className="text-foreground/40">—</span>;
  }
  const ratio = Math.min(1, used / total);
  const tone =
    ratio === 0
      ? "bg-red-500/60"
      : ratio < 0.5
        ? "bg-amber-500/70"
        : ratio < 1
          ? "bg-emerald-500/70"
          : "bg-brand/70";

  return (
    <div className="min-w-28">
      <div className="flex items-baseline gap-1.5">
        <span className="font-medium tabular-nums">{used}</span>
        <span className="text-foreground/40">/ {total}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Прогресс работника в таблице — та же визуальная логика, что и у мест. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="min-w-24">
      <span className="text-xs tabular-nums text-foreground/70">{pct}%</span>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            "h-full rounded-full",
            pct === 0 ? "bg-foreground/20" : pct < 50 ? "bg-amber-500/70" : "bg-emerald-500/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** «сегодня» / «3 дня назад» / дата — короткая колонка активности. */
export function relativeDays(date: Date | null, now: Date = new Date()): string {
  if (!date) return "не заходил";
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  return date.toLocaleDateString("ru-RU");
}
