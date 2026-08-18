import type { Metadata } from "next";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { StaticPageBody } from "@/components/landing/static-page-body";
import { DraftRequisitesNotice } from "@/components/landing/draft-requisites-notice";
import { offerB2bMarkdown } from "@/content/legal";
import { currentSite } from "@/lib/seo/site";
import { pageAlternates } from "@/lib/seo/site";

export const revalidate = 300;

// Оферта для организаций. Отдельный документ, а не раздел /offer: у юрлица нет
// статуса потребителя, другой акцепт, предмет (места в лицензии) и приёмка по акту.
// Текст по умолчанию — src/content/legal/offer-b2b.ts, переопределяется в /admin/seo.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/offer-b2b");
  return {
    title: s.title,
    description: s.description,
    alternates: await pageAlternates("/offer-b2b"),
    robots: { index: !s.noindex, follow: true },
  };
}

export default async function OfferB2bPage() {
  const s = await getStaticPageSeo("/offer-b2b");
  // Страновая редакция документа: приложение под право страны домена.
  const site = await currentSite();
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Публичная оферта для организаций</h1>
      <DraftRequisitesNotice />
      <StaticPageBody text={s.body ?? offerB2bMarkdown(site?.code ?? "BY", site?.host)} />
    </main>
  );
}
