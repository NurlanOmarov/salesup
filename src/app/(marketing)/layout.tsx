import { SiteHeader } from "@/components/landing/site-header";
import { PromoBanner } from "@/components/marketing/promo-banner";
import { promoActive, promoEndsAt, promoEndsLabel } from "@/lib/pricing/promo";
import { getLocale } from "@/i18n/server";
import { SiteFooter } from "@/components/landing/site-footer";
import { MarketingAnalytics } from "@/components/analytics/marketing-analytics";
import { PageViewTracker } from "@/components/analytics/pageview-tracker";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Полоса акции — на всех публичных страницах разом: цену со скидкой человек
  // видит и в каталоге, и в оферте, и объяснение должно быть рядом везде.
  const locale = await getLocale();
  const promo = promoActive();

  return (
    <div className="flex min-h-screen flex-col">
      {promo ? (
        <PromoBanner
          endsAtIso={promoEndsAt().toISOString()}
          endsLabel={promoEndsLabel(locale)}
        />
      ) : null}
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      {/* Счётчики GA4/Метрики + свой page.view — только публичные страницы (D-002). */}
      <MarketingAnalytics />
      <PageViewTracker />
    </div>
  );
}
