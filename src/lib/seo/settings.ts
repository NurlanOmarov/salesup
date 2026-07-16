import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { SeoSettings } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Глобальные SEO-настройки (singleton). Источник — таблица SeoSettings; если строки
 * ещё нет, отдаём дефолты (из схемы). Кэшируется тегом "seo-settings" и сбрасывается
 * в action при сохранении — чтение в layout не бьёт в БД на каждый запрос.
 */

export const SEO_SETTINGS_TAG = "seo-settings";
export const SEO_SETTINGS_ID = "singleton";

/** Дефолты на случай пустой таблицы — держим синхронно с @default в schema.prisma. */
export const SEO_DEFAULTS = {
  id: SEO_SETTINGS_ID,
  titleTemplate: "%s · ACTIVE SALES",
  defaultTitle: "Бизнес-платформа ACTIVE SALES — курсы по продажам с AI-наставником",
  defaultDescription:
    "Онлайн-курсы по техникам продаж: видеоуроки, AI-тренажёр на материале тренера, тесты и сертификаты.",
  socialInstagram: null,
  socialTelegram: null,
  socialYoutube: null,
  socialTiktok: null,
  defaultOgKey: null,
  googleVerification: null,
  yandexVerification: null,
  ga4Id: null,
  yandexMetricaId: null,
  updatedAt: new Date(0),
} satisfies SeoSettings;

const load = unstable_cache(
  async (): Promise<SeoSettings> => {
    const row = await db.seoSettings.findUnique({ where: { id: SEO_SETTINGS_ID } });
    return row ?? SEO_DEFAULTS;
  },
  ["seo-settings"],
  { tags: [SEO_SETTINGS_TAG], revalidate: 300 },
);

/** Кэшированное чтение настроек (для layout / публичных страниц). */
export async function getSeoSettings(): Promise<SeoSettings> {
  return load();
}

/** Сбросить кэш после сохранения в админке. */
export function revalidateSeoSettings() {
  revalidateTag(SEO_SETTINGS_TAG);
}

/** Ссылки соцпрофилей → массив для sameAs (пустые отбрасываются). */
export function socialLinks(s: SeoSettings): string[] {
  return [s.socialInstagram, s.socialTelegram, s.socialYoutube, s.socialTiktok].filter(
    (v): v is string => Boolean(v),
  );
}
