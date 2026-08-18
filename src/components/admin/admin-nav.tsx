"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, GraduationCap } from "lucide-react";

/**
 * Навигация консоли владельца.
 *
 * Было двенадцать ссылок одним рядом: на ноутбуке они наезжали друг на друга, а
 * текущий раздел ничем не выделялся. Теперь пункты собраны в четыре группы по
 * задачам владельца (кого учим → что учим → сколько стоит → как идёт), активные
 * группа и пункт подсвечены, а на мобильном меню раскрывается кнопкой.
 */
interface NavItem {
  href: string;
  label: string;
  hint?: string;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Люди",
    items: [
      { href: "/admin/students", label: "Ученики", hint: "Создание учёток и выдача доступа" },
      { href: "/admin/orgs", label: "Организации", hint: "B2B: лицензии и места" },
      { href: "/admin/leads", label: "Заявки", hint: "Обращения с лендинга" },
    ],
  },
  {
    label: "Контент",
    items: [
      { href: "/admin/courses", label: "Курсы", hint: "Публикация и метаданные" },
      { href: "/admin/reviews", label: "Отзывы с карт", hint: "Цитаты с Яндекс и Google Карт" },
      { href: "/admin/certificates", label: "Сертификаты", hint: "Выдача и проверка" },
      { href: "/admin/seo", label: "SEO", hint: "Метаданные по доменам и языкам" },
    ],
  },
  {
    label: "Деньги",
    items: [
      { href: "/admin/pricing", label: "Тарифы", hint: "Цены курсов и подписки" },
      { href: "/admin/usage", label: "Расходы LLM", hint: "Лимиты и стоимость AI" },
    ],
  },
  {
    label: "Показатели",
    items: [
      { href: "/admin/analytics", label: "Аналитика", hint: "Трафик и конверсия" },
      { href: "/admin/digest", label: "Дайджест", hint: "Еженедельная сводка" },
      { href: "/admin/flags", label: "Активность", hint: "Подозрительные сессии" },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="size-7" priority />
          <span className="text-base font-bold tracking-tight text-brand">ACTIVE SALES</span>
        </Link>

        <span className="hidden text-xs font-medium text-foreground/40 sm:inline">консоль</span>

        {/* Десктоп: группы с выпадающими списками */}
        <nav className="ml-4 hidden items-center gap-1 text-sm lg:flex">
          {GROUPS.map((group) => {
            const groupActive = group.items.some((i) => isActive(pathname, i.href));
            return (
              <div key={group.label} className="group relative">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors ${
                    groupActive
                      ? "bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                      : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  {group.label}
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
                <div className="invisible absolute left-0 top-full z-40 w-60 rounded-xl border border-foreground/10 bg-background p-1.5 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 transition-colors ${
                        isActive(pathname, item.href)
                          ? "bg-foreground/5 font-semibold"
                          : "hover:bg-foreground/5"
                      }`}
                    >
                      {item.label}
                      {item.hint ? (
                        <span className="mt-0.5 block text-xs font-normal text-foreground/45">
                          {item.hint}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/app"
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
          >
            <GraduationCap className="size-4" />
            Обучение
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            className="rounded-md border border-foreground/15 p-1.5 lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Мобильное меню: те же группы списком */}
      {open ? (
        <nav className="border-t border-foreground/10 bg-background px-4 pb-4 pt-2 lg:hidden">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                  {group.label}
                </p>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive(pathname, item.href)
                          ? "bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                          : "hover:bg-foreground/5"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/5 sm:hidden"
            >
              Перейти в обучение
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
