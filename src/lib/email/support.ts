import { env } from "@/env";
import { countryContacts } from "@/lib/seo/country-contacts";
import { supportLinks, type SupportLink } from "@/lib/email/layout";

/**
 * Ссылки поддержки для подвала письма. Письмо уходит из очереди или вебхука, где
 * нет запроса пользователя, поэтому «текущий домен» взять неоткуда — страна
 * определяется явно: рынком организации (Organization.site) или, для розничного
 * покупателя, белорусской витриной по умолчанию.
 *
 * Отдельно от getSupportContacts (lib/seo/settings): та завязана на запрос
 * (заголовок Host, cookie языка) и в воркере не работает.
 */
export function emailSupportLinks(siteCode?: string | null): SupportLink[] {
  const local = countryContacts(siteCode);
  return supportLinks({
    whatsapp: local?.whatsapp ?? null,
    phone: local?.phone ?? null,
    telegram: env.NEXT_PUBLIC_SUPPORT_TELEGRAM ?? null,
  });
}
