import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { MarketingAnalytics } from "@/components/analytics/marketing-analytics";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      {/* Счётчики GA4/Метрики — только публичные страницы (D-002). */}
      <MarketingAnalytics />
    </div>
  );
}
