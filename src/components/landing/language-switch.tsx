"use client";

import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, localizePath, type Locale } from "@/i18n/routing";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";

/**
 * Переключатель языка витрины (казахская версия, docs/MULTI-DOMAIN-PLAN.md).
 *
 * Показывается только там, где второй язык действительно есть, — это решает
 * сервер: список языков приходит пропсом из шапки, а не вычисляется на клиенте,
 * иначе на .by и .ru мелькала бы неработающая кнопка.
 *
 * Ссылка ведёт на текущую страницу в другом языке: /courses ↔ /kk/courses.
 */
/** Короткие подписи: в переключателе нужен код языка, а не его название. */
const LABEL: Record<Locale, string> = { ru: "РУС", kk: "ҚАЗ", uz: "O'Z" };

export function LanguageSwitch({ locales }: { locales: readonly Locale[] }) {
  const current = useLocale();
  const pathname = usePathname();
  const t = messagesFor(current);

  if (locales.length < 2) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 p-0.5 text-xs"
      aria-label={t.language.label}
    >
      <Languages className="ml-1.5 hidden size-3.5 text-white/50 sm:block" aria-hidden />
      {LOCALES.filter((l) => locales.includes(l)).map((l) => (
        <a
          key={l}
          href={localizePath(pathname, l)}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          className={
            l === current
              ? "rounded-full bg-white/15 px-1.5 py-1 font-semibold text-white sm:px-2"
              : "rounded-full px-1.5 py-1 text-white/60 transition-colors hover:text-white sm:px-2"
          }
        >
          {LABEL[l]}
        </a>
      ))}
    </div>
  );
}
