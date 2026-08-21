import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { SeoSettings } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { applyOverride, scopeChain } from "@/lib/seo/scope";
import { currentSite } from "@/lib/seo/site";
import { DEFAULT_SITE } from "@/lib/seo/site-hosts";
import { getLocale } from "@/i18n/server";
import { messagesFor } from "@/i18n/messages";
import { DEFAULT_LOCALE } from "@/i18n/routing";

/**
 * SEO-настройки текущего домена и языка. База — singleton SeoSettings, поверх неё
 * накладываются переопределения SeoScopeOverride по цепочке global → KZ → KZ-kk
 * (мультидомен, D-013): у каждого ресурса свой код подтверждения прав, свои
 * гео-заголовки и свой номер поддержки, а всё общее заполняется один раз.
 * Кэшируется тегом "seo-settings" и сбрасывается в action при сохранении.
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
  // Адреса школы по умолчанию: владелец меняет их в /admin/seo, но до первой
  // правки футер и sameAs в разметке организации уже работают.
  socialInstagram: "https://www.instagram.com/activesales.by/",
  socialTelegram: null,
  socialYoutube: "https://www.youtube.com/channel/UCI9_MiDDbAsfctHtXtsG5Bw",
  socialTiktok: "https://www.tiktok.com/@dubovikvitaliy",
  socialFacebook: "https://www.facebook.com/groups/activesales/",
  socialLinkedin: "https://www.linkedin.com/in/vitaly-dubovik-1ab9204a/",
  socialVk: "https://vk.com/activesalesby",
  // Ссылки на карточки школы известны, а оценку и число отзывов владелец
  // проставляет в /admin/seo: без них блок рейтинга не показывается.
  yandexMapsUrl: "https://yandex.by/maps/org/ektiv_seylz/225492259144/",
  yandexRating: 4.7,
  yandexReviews: null,
  // cid карточки «Бизнес-школа ACTIVE SALES» — устойчивая короткая форма ссылки
  // на организацию в Google Картах (place_id у нас нет, а выдуманный открывает
  // пустую карточку).
  googleMapsUrl: "https://www.google.com/maps?cid=6438951297707191038",
  googleRating: 4.9,
  googleReviews: null,
  defaultOgKey: null,
  googleVerification: null,
  yandexVerification: null,
  ga4Id: null,
  yandexMetricaId: null,
  orgName: "Бизнес-платформа ACTIVE SALES",
  orgDescription: null,
  orgPhone: "+375 (29) 605-30-32",
  orgCountry: "Belarus",
  supportWhatsapp: "https://wa.me/375296053032",
  updatedAt: new Date(0),
} satisfies SeoSettings;

const load = unstable_cache(
  async (): Promise<SeoSettings> => {
    // Образ собирается без доступной БД (CI/Docker) — при сборке отдаём дефолты,
    // реальные значения подтянет ISR в рантайме. См. buildSafe.
    return buildSafe(async () => {
      const row = await db.seoSettings.findUnique({ where: { id: SEO_SETTINGS_ID } });
      return row ?? SEO_DEFAULTS;
    }, SEO_DEFAULTS);
  },
  ["seo-settings"],
  { tags: [SEO_SETTINGS_TAG], revalidate: 300 },
);

const loadOverrides = unstable_cache(
  async () => buildSafe(() => db.seoScopeOverride.findMany(), []),
  ["seo-scope-overrides"],
  { tags: [SEO_SETTINGS_TAG], revalidate: 300 },
);

/**
 * Кэшированное чтение настроек текущего домена/языка (layout, публичные страницы).
 * Переопределения накладываются от общего к частному, поэтому частный вариант
 * может задать одно поле и унаследовать остальные.
 */
export async function getSeoSettings(): Promise<SeoSettings> {
  const [base, overrides, site, locale] = await Promise.all([
    load(),
    loadOverrides(),
    currentSite(),
    getLocale(),
  ]);
  const hasLocaleDefaults = locale !== DEFAULT_LOCALE;
  if (!overrides.length && !hasLocaleDefaults) return base;

  let result = base;
  // Казахская версия получает свои заголовок и описание из словаря — иначе до
  // первой правки в /admin/seo её страницы уходили бы в индекс с русским title.
  if (locale !== DEFAULT_LOCALE) {
    const seo = messagesFor(locale).seo;
    result = applyOverride(result, {
      titleTemplate: seo.titleTemplate,
      defaultTitle: seo.defaultTitle,
      defaultDescription: seo.defaultDescription,
    });
  }
  // reverse: сначала общее, затем всё более частное — последнее слово за точным.
  for (const scope of [...scopeChain(site?.code ?? "BY", locale)].reverse()) {
    result = applyOverride(result, overrides.find((o) => o.scope === scope));
  }
  return result;
}

/**
 * Базовые настройки без наложений — для формы в /admin/seo: админка правит
 * значения «для всех доменов», а не то, что показывает её собственный домен.
 */
export async function getBaseSeoSettings(): Promise<SeoSettings> {
  return load();
}

/** Переопределения одного разреза — для формы в /admin/seo. */
export async function getScopeOverride(scope: string) {
  return buildSafe(() => db.seoScopeOverride.findUnique({ where: { scope } }), null);
}

/** Все переопределения — админке нужны, чтобы показать унаследованные значения. */
export async function getScopeOverrides() {
  return loadOverrides();
}

/** Сбросить кэш после сохранения в админке. */
export function revalidateSeoSettings() {
  revalidateTag(SEO_SETTINGS_TAG);
}

/** Ссылки соцпрофилей → массив для sameAs (пустые отбрасываются). */
export { socialLinks, socialProfiles } from "./social";

export { externalRatings } from "./ratings";

export interface SupportContacts {
  phone: string; // человекочитаемый, "+375 (29) 605-30-32"
  phoneHref: string; // tel:+375296053032
  whatsapp: string; // ссылка wa.me
  telegram: string | null; // ссылка t.me (env — редко меняется)
  viber: string | null; // viber://add?number=… — только на белорусском домене
}

/**
 * Контакты поддержки для футера, лендинга, «забыли пароль» и кабинета ученика.
 * Телефон и WhatsApp правятся владельцем в /admin/seo (SeoSettings, кэш 5 мин);
 * Telegram — из env (смена хэндла — редкое событие уровня деплоя).
 *
 * Viber показывается только на белорусском домене (в РБ это рабочий мессенджер
 * поддержки, на .kz/.ru им не пользуются) и ведёт на тот же номер, что телефон
 * поддержки этого домена, — отдельного поля в настройках он не требует.
 * Неизвестный хост (dev, превью) считается белорусской витриной: DEFAULT_SITE.
 */
export async function getSupportContacts(): Promise<SupportContacts> {
  const [s, site] = await Promise.all([getSeoSettings(), currentSite()]);
  const digits = s.orgPhone.replace(/\D/g, "");
  const isBelarus = (site?.code ?? DEFAULT_SITE.code) === "BY";
  return {
    phone: s.orgPhone,
    phoneHref: `tel:${s.orgPhone.replace(/[^\d+]/g, "")}`,
    whatsapp: s.supportWhatsapp,
    telegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || null,
    viber: isBelarus && digits ? `viber://add?number=${digits}` : null,
  };
}
