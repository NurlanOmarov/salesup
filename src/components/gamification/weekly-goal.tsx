import type { CSSProperties } from "react";
import { Target, Check } from "lucide-react";

/**
 * Виджет учебной цели: кольцо «уроков завершено за неделю / цель». Цель задаётся в
 * настройках (User.weeklyGoal). Чистый SVG, без клиентского кода: кольцо
 * дорисовывается от пустого до текущего значения CSS-анимацией (.ring-progress).
 */
export function WeeklyGoal({ done, goal }: { done: number; goal: number }) {
  const safeGoal = Math.max(1, goal);
  const percent = Math.min(100, Math.round((done / safeGoal) * 100));
  const reached = done >= safeGoal;

  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-background p-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-foreground/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={`ring-progress ${reached ? "text-emerald-500" : "text-amber-500"}`}
            style={{ "--ring-c": c } as CSSProperties}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          {reached ? (
            <Check className="size-7 text-emerald-600" />
          ) : (
            <>
              <span className="text-xl font-bold leading-none">{done}</span>
              <span className="text-xs text-foreground/50">из {safeGoal}</span>
            </>
          )}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Target className="size-4 text-amber-600" />
          Цель недели
        </div>
        <p className="mt-1 text-sm text-foreground/60">
          {reached
            ? "Цель достигнута — отличная неделя! 🎉"
            : `Ещё ${safeGoal - done} ${pluralLessons(safeGoal - done)} до цели.`}
        </p>
      </div>
    </div>
  );
}

function pluralLessons(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "урок";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "урока";
  return "уроков";
}
