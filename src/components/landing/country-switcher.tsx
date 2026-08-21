"use client";

import { usePathname } from "next/navigation";
import { SITE_HOSTS } from "@/lib/seo/site-hosts";
import type { Locale } from "@/i18n/routing";

/**
 * Выбор страны в футере: те же страницы на своём ccTLD (мультидомен,
 * docs/MULTI-DOMAIN-PLAN.md). Ссылки ведут на текущий путь чужого домена и
 * помечены rel="alternate" + hreflang — это видимый аналог hreflang-разметки:
 * посетитель попадает на «свою» версию, а поисковик получает взаимные ссылки
 * между региональными вариантами.
 *
 * Переход на другой домен = другая сессия (куки скоупятся по хосту), поэтому
 * переключатель живёт только в публичном футере, а не в кабинете.
 */
export function CountrySwitcher({
  currentHost,
  locale,
}: {
  currentHost: string | null;
  /** Названия стран — на языке страницы: казахская витрина пишет «Қазақстан». */
  locale: Locale;
}) {
  const pathname = usePathname();
  const path = pathname === "/" ? "" : pathname;

  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {SITE_HOSTS.map((s) => {
        const active = s.host === currentHost;
        return (
          <li key={s.host}>
            {active ? (
              <span aria-current="true" className="font-semibold text-white/80">
                {s.country[locale]}
              </span>
            ) : (
              <a
                href={`https://${s.host}${path}`}
                hrefLang={s.hreflang}
                rel="alternate"
                className="transition-colors hover:text-brand-light"
              >
                {s.country[locale]}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
