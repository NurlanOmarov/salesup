import type { Metadata } from "next";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { StaticPageBody } from "@/components/landing/static-page-body";
import { DraftRequisitesNotice } from "@/components/landing/draft-requisites-notice";
import { privacyMarkdown } from "@/content/legal";
import { currentSite } from "@/lib/seo/site";
import { pageAlternates } from "@/lib/seo/site";

export const revalidate = 300;

// Текст по умолчанию — src/content/legal/privacy.ts; владелец может переопределить
// его в /admin/seo (StaticPageSeo.body) вместе с мета-тегами и noindex.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/privacy");
  return {
    title: s.title,
    description: s.description,
    alternates: await pageAlternates("/privacy"),
    robots: { index: !s.noindex, follow: true },
  };
}

export default async function PrivacyPage() {
  const s = await getStaticPageSeo("/privacy");
  // Страновая редакция документа: приложение под право страны домена.
  const site = await currentSite();
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">
        Политика в отношении обработки персональных данных
      </h1>
      <DraftRequisitesNotice />
      <StaticPageBody text={s.body ?? privacyMarkdown(site?.code ?? "BY", site?.host)} />
    </main>
  );
}
