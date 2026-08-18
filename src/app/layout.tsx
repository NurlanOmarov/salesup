import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { getSeoSettings, socialLinks } from "@/lib/seo/settings";
import { currentSite, siteOrigin } from "@/lib/seo/site";

/**
 * Метаданные читаются из SeoSettings (админка «SEO-настройки»): шаблон title,
 * дефолтные title/description, подтверждение прав в Search Console / Вебмастере.
 * Кэшируется тегом seo-settings — сбрасывается при сохранении в админке.
 *
 * metadataBase берётся из хоста запроса (мультидомен, docs/MULTI-DOMAIN-PLAN.md):
 * относительные canonical на публичных страницах разворачиваются в свой домен —
 * .kz ранжируется в РК, .ru в РФ, .by в РБ.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [s, origin] = await Promise.all([getSeoSettings(), siteOrigin()]);
  return {
    metadataBase: new URL(origin),
    title: { default: s.defaultTitle, template: s.titleTemplate },
    description: s.defaultDescription,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "ACTIVE SALES",
    },
    // metadata.icons отключает автоподхват файловой конвенции целиком — icon.png нужно указывать явно
    icons: { icon: "/icon.png", apple: "/api/icon?size=180" },
    openGraph: { type: "website", siteName: "Бизнес-платформа ACTIVE SALES", locale: "ru_RU" },
    twitter: {
      card: "summary_large_image",
      title: s.defaultTitle,
      description: s.defaultDescription,
    },
    verification: {
      ...(s.googleVerification ? { google: s.googleVerification } : {}),
      ...(s.yandexVerification
        ? { yandex: s.yandexVerification }
        : {}),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [s, origin, site] = await Promise.all([getSeoSettings(), siteOrigin(), currentSite()]);

  // Сайт-вайд разметка организации (Knowledge Panel, брендовая выдача).
  // Название/описание/телефон/страна редактируются в /admin/seo (SeoSettings).
  const sameAs = socialLinks(s);
  const orgPhone = s.orgPhone;
  // Страна обслуживания — по домену захода (гео-сигнал для поиска своей страны),
  // для неизвестного хоста — значение из /admin/seo.
  const areaCountry = site?.country ?? s.orgCountry;
  const orgJsonLd = {
    "@context": "https://schema.org",
    // Organization, а не EducationalOrganization: по D-012 услуги оформлены как
    // информационные, платформа не является учреждением образования.
    "@type": "Organization",
    name: s.orgName,
    url: origin,
    logo: `${origin}/logo.png`,
    description: s.orgDescription ?? s.defaultDescription,
    areaServed: { "@type": "Country", name: areaCountry },
    ...(sameAs.length ? { sameAs } : {}),
    ...(orgPhone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: orgPhone,
            contactType: "customer support",
            areaServed: areaCountry,
            availableLanguage: ["Russian"],
          },
        }
      : {}),
  };

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
