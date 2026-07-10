"use client";

import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";

/**
 * Переключатель темы: Системная / Светлая / Тёмная. Хранит выбор в localStorage
 * ('theme') и сразу применяет класс .dark/.light на <html> (тот же контракт, что и
 * ThemeScript при загрузке). Сегментированный контрол.
 */
type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "Системная", icon: Monitor },
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
];

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const c = document.documentElement.classList;
  c.toggle("dark", dark);
  c.toggle("light", !dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  // Когда выбрана «системная» — реагируем на смену темы ОС на лету.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    apply(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className="inline-flex gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1"
    >
      {OPTIONS.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-background text-amber-700 shadow-sm" : "text-foreground/60 hover:text-foreground",
            ].join(" ")}
          >
            <o.icon className="size-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
