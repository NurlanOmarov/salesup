import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightLeft, Radar, FileText, Gauge } from "lucide-react";
import { env } from "@/env";
import {
  getBaseSeoSettings,
  getScopeOverride,
  getScopeOverrides,
} from "@/lib/seo/settings";
import { getStaticPageRows, STATIC_PAGES } from "@/lib/seo/static-pages";
import {
  GLOBAL_SCOPE,
  SEO_SCOPES,
  applyOverride,
  isKnownScope,
  parentScopes,
} from "@/lib/seo/scope";
import { SeoSettingsForm } from "./settings-form";
import { ScopeOverrideForm, type ScopeOverrideFields } from "./scope-override-form";
import { CannibalizationWidget } from "./cannibalization";
import { StaticPagesForm, type StaticPageFormRow } from "./static-pages-form";
import { CoursesSeoStatus, SitemapStatus } from "./seo-status";

export const metadata: Metadata = {
  title: "SEO-настройки",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  // Разрез: «Все домены» либо конкретный домен/язык (мультидомен, D-013).
  const requested = (await searchParams).scope;
  const scope = requested && isKnownScope(requested) ? requested : GLOBAL_SCOPE;
  const scopeLabel = SEO_SCOPES.find((o) => o.scope === scope)!.label;

  const [s, staticRows, override, overrides] = await Promise.all([
    getBaseSeoSettings(),
    getStaticPageRows(scope),
    getScopeOverride(scope),
    getScopeOverrides(),
  ]);

  // Что действует для этого разреза, если он ничего не переопределяет, —
  // показываем в placeholder, чтобы владелец видел наследуемое значение.
  let inheritedSettings: Record<string, unknown> = { ...s };
  for (const parent of [...parentScopes(scope)].reverse()) {
    inheritedSettings = applyOverride(
      inheritedSettings,
      overrides.find((o) => o.scope === parent),
    );
  }
  const str = (key: string) => {
    const v = inheritedSettings[key];
    return typeof v === "string" && v ? v : null;
  };
  const overrideValues: ScopeOverrideFields = {
    titleTemplate: override?.titleTemplate ?? "",
    defaultTitle: override?.defaultTitle ?? "",
    defaultDescription: override?.defaultDescription ?? "",
    googleVerification: override?.googleVerification ?? "",
    yandexVerification: override?.yandexVerification ?? "",
    ga4Id: override?.ga4Id ?? "",
    yandexMetricaId: override?.yandexMetricaId ?? "",
    orgDescription: override?.orgDescription ?? "",
    orgCountry: override?.orgCountry ?? "",
    orgPhone: override?.orgPhone ?? "",
    supportWhatsapp: override?.supportWhatsapp ?? "",
    socialTelegram: override?.socialTelegram ?? "",
  };

  const staticPages: StaticPageFormRow[] = STATIC_PAGES.map((p) => {
    const row = staticRows.find((r) => r.path === p.path);
    return {
      path: p.path,
      label: p.label,
      hasBody: p.hasBody,
      fallbackTitle: p.fallbackTitle,
      fallbackDescription: p.fallbackDescription,
      title: row?.title ?? "",
      description: row?.description ?? "",
      noindex: row ? row.noindex : p.defaultNoindex,
      body: row?.body ?? "",
    };
  });

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">SEO-настройки</h1>
          <p className="mt-1 max-w-2xl text-foreground/60">
            Метаданные, соцпрофили, подтверждение прав в поисковиках и маркетинговые
            счётчики — меняются без деплоя. Метаданные конкретного курса задаются в его
            карточке и имеют приоритет над этими значениями.
          </p>
        </div>
        <Link
          href="/admin/seo/redirects"
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          <ArrowRightLeft className="size-4" />
          Редиректы
        </Link>
      </div>

      {/* Разрез: общие настройки либо конкретный домен/язык */}
      <nav className="mt-5 flex flex-wrap gap-1.5">
        {SEO_SCOPES.map((o) => (
          <Link
            key={o.scope}
            href={o.scope === GLOBAL_SCOPE ? "/admin/seo" : `/admin/seo?scope=${o.scope}`}
            title={o.hint}
            className={
              o.scope === scope
                ? "rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/5"
            }
          >
            {o.label}
          </Link>
        ))}
      </nav>

      {/* Sitemap/robots — быстрый статус без dev-инструментов */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <Gauge className="size-4 text-amber-500" />
          Sitemap и robots
        </h2>
        <SitemapStatus />
      </section>

      {/* SEO-статус курсов одним экраном */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <Gauge className="size-4 text-amber-500" />
          SEO-статус опубликованных курсов
        </h2>
        <CoursesSeoStatus />
      </section>

      {/* Статические страницы: каталог, оферта, политика */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <FileText className="size-4 text-amber-500" />
          Статические страницы
        </h2>
        <p className="mt-1 text-xs text-foreground/50">
          Метаданные каталога и текст оферты/политики. Пока текст thin-страницы пуст,
          она остаётся noindex; наполните (можно AI-черновиком) и снимите галочку.
        </p>
        <StaticPagesForm pages={staticPages} scope={scope} />
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <Radar className="size-4 text-amber-500" />
          Каннибализация курсов (AI, embeddings)
        </h2>
        <p className="mt-1 text-xs text-foreground/50">
          Проверка, не конкурируют ли курсы за один поисковый запрос из-за слишком
          похожих метаданных. Раз в неделю выполняется автоматически — итог в дайджесте.
        </p>
        <CannibalizationWidget />
      </section>

      {scope === GLOBAL_SCOPE ? (
      <SeoSettingsForm
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        settings={{
          titleTemplate: s.titleTemplate,
          defaultTitle: s.defaultTitle,
          defaultDescription: s.defaultDescription,
          socialInstagram: s.socialInstagram,
          socialTelegram: s.socialTelegram,
          socialYoutube: s.socialYoutube,
          socialTiktok: s.socialTiktok,
          defaultOgKey: s.defaultOgKey,
          googleVerification: s.googleVerification,
          yandexVerification: s.yandexVerification,
          ga4Id: s.ga4Id,
          yandexMetricaId: s.yandexMetricaId,
          orgName: s.orgName,
          orgDescription: s.orgDescription,
          orgPhone: s.orgPhone,
          orgCountry: s.orgCountry,
          supportWhatsapp: s.supportWhatsapp,
        }}
      />
      ) : (
        <ScopeOverrideForm
          scope={scope}
          scopeLabel={scopeLabel}
          values={overrideValues}
          inherited={{
            titleTemplate: str("titleTemplate"),
            defaultTitle: str("defaultTitle"),
            defaultDescription: str("defaultDescription"),
            googleVerification: str("googleVerification"),
            yandexVerification: str("yandexVerification"),
            ga4Id: str("ga4Id"),
            yandexMetricaId: str("yandexMetricaId"),
            orgDescription: str("orgDescription"),
            orgCountry: str("orgCountry"),
            orgPhone: str("orgPhone"),
            supportWhatsapp: str("supportWhatsapp"),
            socialTelegram: str("socialTelegram"),
          }}
        />
      )}
    </main>
  );
}
