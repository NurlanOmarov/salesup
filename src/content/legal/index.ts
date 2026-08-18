/**
 * Юридические документы платформы (право Республики Беларусь): публичная оферта
 * для физических лиц, оферта для организаций и политика в отношении обработки
 * персональных данных.
 *
 * Тексты живут в коде — это редакции по умолчанию для /offer и /privacy. Каждый
 * документ — функция от страны домена: основной текст по праву РБ плюс страновое
 * приложение для .kz/.ru (./country.ts, docs/MULTI-DOMAIN-PLAN.md).
 * Владелец может переопределить любой из них в /admin/seo (StaticPageSeo.body):
 * непустой body имеет приоритет. Реквизиты и версия документов — requisites.ts.
 */
export { offerMarkdown } from "./offer";
export { offerB2bMarkdown } from "./offer-b2b";
export { privacyMarkdown } from "./privacy";
export { legalVersion, type LegalCountry } from "./country";
export {
  LEGAL_DATE,
  LEGAL_VERSION,
  REQUISITES,
  REQUISITES_FILLED,
  SITE_DOMAIN,
} from "./requisites";
