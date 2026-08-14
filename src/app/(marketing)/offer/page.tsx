import type { Metadata } from "next";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { StaticPageBody } from "@/components/landing/static-page-body";
import { DraftRequisitesNotice } from "@/components/landing/draft-requisites-notice";
import { OFFER_MARKDOWN } from "@/content/legal";

export const revalidate = 300;

// Текст по умолчанию — src/content/legal/offer.ts; владелец может переопределить
// его в /admin/seo (StaticPageSeo.body) вместе с мета-тегами и noindex.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/offer");
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: "/offer" },
    robots: { index: !s.noindex, follow: true },
  };
}

export default async function OfferPage() {
  const s = await getStaticPageSeo("/offer");
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Публичная оферта</h1>
      <DraftRequisitesNotice />
      <StaticPageBody text={s.body ?? OFFER_MARKDOWN} />
    </main>
  );
}
