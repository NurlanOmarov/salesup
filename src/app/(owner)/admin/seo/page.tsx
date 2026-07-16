import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightLeft, Radar } from "lucide-react";
import { env } from "@/env";
import { getSeoSettings } from "@/lib/seo/settings";
import { SeoSettingsForm } from "./settings-form";
import { CannibalizationWidget } from "./cannibalization";

export const metadata: Metadata = {
  title: "SEO-настройки",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  const s = await getSeoSettings();

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

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <Radar className="size-4 text-amber-500" />
          Каннибализация курсов (AI, embeddings)
        </h2>
        <p className="mt-1 text-xs text-foreground/50">
          Проверка, не конкурируют ли курсы за один поисковый запрос из-за слишком
          похожих метаданных.
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
          googleVerification: s.googleVerification,
          yandexVerification: s.yandexVerification,
          ga4Id: s.ga4Id,
          yandexMetricaId: s.yandexMetricaId,
        }}
      />
    </main>
  );
}
