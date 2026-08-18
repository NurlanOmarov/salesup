import { DEFAULT_LOCALE, type Locale } from "@/i18n/routing";
import { SITE_HOSTS, DEFAULT_SITE } from "@/lib/seo/site-hosts";

/**
 * Разрез SEO-настроек: домен и язык (мультидомен, D-013).
 *
 * Раньше настройки были одни на весь сайт — при трёх доменах этого мало: у
 * каждого ресурса свой код подтверждения прав в Search Console и Вебмастере,
 * свои гео-заголовки («курсы по продажам в Казахстане») и свой номер поддержки.
 *
 * Значения наследуются от общего к частному: global → KZ → KZ-kk. Пустое поле
 * в частном варианте берётся из более общего, поэтому заполнять нужно только
 * то, что действительно отличается.
 */
export const GLOBAL_SCOPE = "global";

export interface SeoScopeOption {
  scope: string;
  label: string;
  hint: string;
}

/** Варианты для админки: «Все домены» + по домену, плюс казахская версия. */
export const SEO_SCOPES: SeoScopeOption[] = [
  { scope: GLOBAL_SCOPE, label: "Все домены", hint: "База: применяется, пока не переопределено" },
  ...SITE_HOSTS.map((s) => ({
    scope: s.code,
    label: `${s.country} — ${s.host}`,
    hint: `Русская версия домена ${s.host}`,
  })),
  {
    scope: "KZ-kk",
    label: "Казахстан, қазақша — /kk",
    hint: "Казахская версия study.activesales.kz",
  },
];

/** Цепочка от точного варианта к общему — в этом порядке ищутся значения. */
export function scopeChain(countryCode: string, locale: Locale = DEFAULT_LOCALE): string[] {
  const country = SITE_HOSTS.some((s) => s.code === countryCode) ? countryCode : DEFAULT_SITE.code;
  return locale === DEFAULT_LOCALE
    ? [country, GLOBAL_SCOPE]
    : [`${country}-${locale}`, country, GLOBAL_SCOPE];
}

/** Разрез, который можно переопределять: любой известный, кроме общего. */
export function isOverridableScope(scope: string): boolean {
  return isKnownScope(scope) && scope !== GLOBAL_SCOPE;
}

/**
 * Разрезы, от которых наследует данный: "KZ-kk" → ["KZ", "global"].
 * Нужны админке, чтобы показать в placeholder то, что действует сейчас.
 */
export function parentScopes(scope: string): string[] {
  if (scope === GLOBAL_SCOPE) return [];
  const [country, locale] = scope.split("-");
  return locale ? [country!, GLOBAL_SCOPE] : [GLOBAL_SCOPE];
}

/** Известен ли такой разрез (валидация значения из формы админки). */
export function isKnownScope(scope: string): boolean {
  return SEO_SCOPES.some((s) => s.scope === scope);
}

/**
 * Накладывает переопределения на базовые значения: непустое поле частного
 * варианта побеждает, пустое (null / "") наследуется.
 */
export function applyOverride<T extends object>(
  base: T,
  override: Record<string, unknown> | null | undefined,
): T {
  if (!override) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "id" || key === "scope" || key === "updatedAt") continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}
