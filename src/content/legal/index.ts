/**
 * Юридические документы платформы (право Республики Беларусь): публичная оферта
 * для физических лиц, оферта для организаций и политика в отношении обработки
 * персональных данных.
 *
 * Тексты живут в коде — это редакции по умолчанию для /offer и /privacy.
 * Владелец может переопределить любой из них в /admin/seo (StaticPageSeo.body):
 * непустой body имеет приоритет. Реквизиты и версия документов — requisites.ts.
 */
export { OFFER_MARKDOWN } from "./offer";
export { OFFER_B2B_MARKDOWN } from "./offer-b2b";
export { PRIVACY_MARKDOWN } from "./privacy";
export {
  LEGAL_DATE,
  LEGAL_VERSION,
  REQUISITES,
  REQUISITES_FILLED,
  SITE_DOMAIN,
} from "./requisites";
