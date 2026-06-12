import { Flame, Lock } from "lucide-react";
import { levelProgress } from "@/lib/gamification/levels";

/**
 * Сдержанный блок прогресса в кабинете (S8): уровень, XP до следующего, серия,
 * бейджи. Без поп-апов и «казино» — фоновый показатель для взрослой аудитории.
 */

export interface BadgeView {
  code: string;
  title: string;
  description: string;
  earned: boolean;
}

export function ProgressPanel({
  xp,
  streakDays,
  badges,
}: {
  xp: number;
  streakDays: number;
  badges: BadgeView[];
}) {
  const p = levelProgress(xp);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-lg font-bold text-amber-700">
            {p.level}
          </div>
          <div>
            <p className="text-sm font-semibold">Уровень {p.level}</p>
            <p className="text-xs text-foreground/50">{p.xp} XP · до уровня {p.level + 1} осталось {p.nextLevelAt - p.xp}</p>
          </div>
        </div>
        {streakDays > 0 ? (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-700">
            <Flame className="size-4" />
            {streakDays} дн.
          </div>
        ) : null}
      </div>

      {/* XP-прогресс до следующего уровня */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${p.percent}%` }} />
      </div>

      {/* Бейджи */}
      {badges.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            Достижения · {earnedCount} из {badges.length}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {badges.map((b) => (
              <div
                key={b.code}
                title={b.description}
                className={[
                  "flex w-[88px] flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                  b.earned ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-foreground/10 bg-foreground/[0.02] opacity-60",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex size-9 items-center justify-center rounded-full text-base",
                    b.earned ? "bg-amber-500/15" : "bg-foreground/10",
                  ].join(" ")}
                >
                  {b.earned ? "🏅" : <Lock className="size-4 text-foreground/30" />}
                </div>
                <span className="text-[11px] font-medium leading-tight text-foreground/70">{b.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
