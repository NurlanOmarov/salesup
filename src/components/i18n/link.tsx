"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useHref } from "@/i18n/client";

/**
 * next/link, который держит посетителя в выбранном языке: внутренние пути
 * получают префикс `/kk` на казахской версии. Внешние ссылки, якоря и mailto/tel
 * не трогаем. Используется вместо next/link во всех локализованных зонах —
 * иначе первый же переход выбрасывал бы казахоязычного ученика на русские URL.
 */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const localize = useHref();
  const localized =
    typeof href === "string" && href.startsWith("/") ? localize(href) : href;
  return <NextLink href={localized} {...props} />;
}
