"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LayoutGrid, Trophy, Award, Settings } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

/**
 * Единая навигация кабинета ученика. На десктопе — горизонтальное меню в верхней
 * «шапке»; на мобильном — нижний таб-бар (под большой палец) + лого и выход сверху.
 * Активный раздел подсвечивается по pathname.
 */

const NAV: { href: string; label: string; icon: typeof LayoutGrid; exact?: boolean }[] = [
  { href: "/app", label: "Обучение", icon: LayoutGrid, exact: true },
  { href: "/app/achievements", label: "Достижения", icon: Trophy },
  { href: "/app/certificates", label: "Сертификаты", icon: Award },
  { href: "/app/settings", label: "Настройки", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function StudentHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/app" className="flex items-center gap-2 font-bold">
          <GraduationCap className="size-5 text-amber-600" />
          <span>SalesAcademy</span>
        </Link>

        {/* Десктоп-меню */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Разделы кабинета">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-500/10 text-amber-700"
                    : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <LogoutButton />
      </div>
    </header>
  );
}

export function StudentTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 backdrop-blur lg:hidden"
      aria-label="Разделы кабинета"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-amber-700" : "text-foreground/55",
              ].join(" ")}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
