import { DEFAULT_SITE, SITE_HOSTS } from "@/lib/seo/site-hosts";

/**
 * Локальные контакты поддержки по домену (мультидомен, D-013).
 *
 * Один белорусский +375 на казахстанской и российской витрине — минус к доверию
 * (для B2B особенно: «звонить за границу»). У каждой страны свой номер, который
 * ученик видит и в футере, и на «забыли пароль», и в кабинете.
 *
 * phone/whatsapp = null означает «в этой стране номера нет» — блок не рисуется
 * вовсе, а не подставляет чужой: в Узбекистане связь только через Telegram.
 *
 * Это дефолты уровня кода; точечное переопределение из /admin/seo (разрез
 * страны) имеет приоритет, см. getSupportContacts.
 */
export interface CountryContacts {
  /** Человекочитаемый номер, null — в стране телефона нет. */
  phone: string | null;
  /** Ссылка wa.me, null — WhatsApp в стране не используем. */
  whatsapp: string | null;
}

const COUNTRY_CONTACTS: Record<string, CountryContacts> = {
  BY: { phone: "+375 (29) 605-30-32", whatsapp: "https://wa.me/375296053032" },
  KZ: { phone: "+7 (705) 830-60-28", whatsapp: "https://wa.me/77058306028" },
  RU: { phone: "+7 (915) 649-96-41", whatsapp: "https://wa.me/79156499641" },
  // Узбекистан: локального номера пока нет — на витрине только Telegram.
  UZ: { phone: null, whatsapp: null },
};

/** Контакты страны домена; null — страна неизвестна (dev, превью). */
export function countryContacts(countryCode: string | null | undefined): CountryContacts | null {
  const code = SITE_HOSTS.some((s) => s.code === countryCode)
    ? countryCode!
    : DEFAULT_SITE.code;
  return COUNTRY_CONTACTS[code] ?? null;
}
