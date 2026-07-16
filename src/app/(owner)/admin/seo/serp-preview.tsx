"use client";

import { cn } from "@/lib/utils";

/**
 * Превью сниппета Google (desktop) + счётчики длины с цветовыми зонами.
 * Переиспользуемо: глобальные настройки и (позже) форма курса.
 * Лимиты — под сниппет: title ≤ 60, description ≤ 155 символов.
 */

export const TITLE_LIMIT = 60;
export const DESC_LIMIT = 155;

function zone(len: number, limit: number): string {
  if (len === 0) return "text-foreground/40";
  if (len <= limit) return "text-emerald-600";
  if (len <= limit + 15) return "text-amber-600";
  return "text-red-600";
}

export function CharCounter({ value, limit }: { value: string; limit: number }) {
  const len = [...value].length;
  return (
    <span className={cn("text-xs tabular-nums", zone(len, limit))}>
      {len}/{limit}
    </span>
  );
}

export function SerpPreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/40">
        Так увидит Google
      </p>
      <div className="max-w-xl font-sans">
        <div className="truncate text-xs text-foreground/60">{host}</div>
        <div className="mt-0.5 truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">
          {title || "Заголовок страницы"}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-foreground/70">
          {description || "Описание страницы появится здесь — это текст, который видят в выдаче."}
        </p>
      </div>
    </div>
  );
}
