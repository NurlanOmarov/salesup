import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightLeft, Radar, FileText, Gauge } from "lucide-react";
import { env } from "@/env";
import { getSeoSettings } from "@/lib/seo/settings";
import { getStaticPageRows, STATIC_PAGES } from "@/lib/seo/static-pages";
import { SeoSettingsForm } from "./settings-form";
import { CannibalizationWidget } from "./cannibalization";
import { StaticPagesForm, type StaticPageFormRow } from "./static-pages-form";
import { CoursesSeoStatus, SitemapStatus } from "./seo-status";

export const metadata: Metadata = {
  title: "SEO-настройки",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  const [s, staticRows] = await Promise.all([getSeoSettings(), getStaticPageRows()]);

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
        <StaticPagesForm pages={staticPages} />
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
        }}
      />
    </main>
  );
}
