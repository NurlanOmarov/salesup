"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "", label: "Обзор" },
  { href: "/employees", label: "Работники" },
  { href: "/invites", label: "Коды доступа" },
  { href: "/reports", label: "Отчёты" },
  { href: "/licenses", label: "Лицензии" },
];

/** Вкладки кабинета организации с подсветкой активной. */
export function OrgNav({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const base = `/org/${orgId}`;

  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
      {ITEMS.map((item) => {
        const href = `${base}${item.href}`;
        const active = item.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-foreground/[0.06] font-semibold"
                : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
