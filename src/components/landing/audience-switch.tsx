"use client";

import { Link } from "@/components/i18n/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Briefcase, User } from "lucide-react";
import {
  AUDIENCE_PATH,
  AUDIENCES,
  type Audience,
} from "@/content/landing/audience";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/client";
import { messagesFor } from "@/i18n/messages";

const ICONS = { b2c: User, b2b: Briefcase } as const;

/**
 * Переключатель «Себе | Команде».
 *
 * Это ссылки, а не кнопки состояния: у регистров разные URL, поэтому обе версии
 * индексируются и на корпоративную можно лить рекламу. Подложка переезжает через
 * layoutId, а prefetch делает переход мгновенным — ощущается как переключение на
 * месте, а не как загрузка другой страницы.
 */
export function AudienceSwitch({
  current,
  size = "nav",
  onDark = false,
  className,
}: {
  /** Если не передан — определяется по текущему пути (нужно в общей шапке). */
  current?: Audience;
  size?: "nav" | "hero";
  /** Переключатель лежит на тёмном фоне (шапка лендинга). */
  onDark?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  // Подписи регистра — на языке страницы (казахская версия витрины).
  const t = messagesFor(useLocale());
  const label: Record<Audience, string> = { b2c: t.audience.self, b2b: t.audience.team };
  const active: Audience =
    current ?? (pathname?.startsWith(AUDIENCE_PATH.b2b) ? "b2b" : "b2c");
  const hero = size === "hero";

  return (
    <div
      role="group"
      aria-label="Для кого"
      className={cn(
        "inline-flex items-center rounded-full border p-1 backdrop-blur",
        onDark
          ? "border-white/15 bg-white/5"
          : "border-foreground/12 bg-background/60",
        className,
      )}
    >
      {AUDIENCES.map((a) => {
        const Icon = ICONS[a];
        const isActive = a === active;
        return (
          <Link
            key={a}
            href={AUDIENCE_PATH[a]}
            prefetch
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full transition-colors",
              hero ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm",
              onDark
                ? isActive
                  ? "text-white"
                  : "text-white/60 hover:text-white/85"
                : isActive
                  ? "text-foreground"
                  : "text-foreground/55 hover:text-foreground/80",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="audience-switch-pill"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className={cn(
                  "absolute inset-0 rounded-full",
                  onDark ? "bg-white/15" : "bg-foreground/[0.07]",
                )}
              />
            ) : null}
            <Icon className={cn("relative", hero ? "size-4" : "size-3.5")} />
            <span className="relative font-medium">{label[a]}</span>
          </Link>
        );
      })}
    </div>
  );
}
