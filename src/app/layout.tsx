import type { Metadata, Viewport } from "next";
import { env } from "@/env";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";
import { getSeoSettings, socialLinks } from "@/lib/seo/settings";

/**
 * Метаданные читаются из SeoSettings (админка «SEO-настройки»): шаблон title,
 * дефолтные title/description, подтверждение прав в Search Console / Вебмастере.
 * Кэшируется тегом seo-settings — сбрасывается при сохранении в админке.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeoSettings();
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: { default: s.defaultTitle, template: s.titleTemplate },
    description: s.defaultDescription,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "ACTIVE SALES",
    },
    // icon.png подхватывается автоматически из src/app/icon.png — дублировать не нужно
    icons: { apple: "/api/icon?size=180" },
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
  const s = await getSeoSettings();

  // Сайт-вайд разметка организации (Knowledge Panel, брендовая выдача).
  // Название/описание/телефон/страна редактируются в /admin/seo (SeoSettings).
  const sameAs = socialLinks(s);
  const orgPhone = s.orgPhone;
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: s.orgName,
    url: env.NEXT_PUBLIC_SITE_URL,
    logo: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/logo.png`,
    description: s.orgDescription ?? s.defaultDescription,
    areaServed: { "@type": "Country", name: s.orgCountry },
    ...(sameAs.length ? { sameAs } : {}),
    ...(orgPhone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: orgPhone,
            contactType: "customer support",
            areaServed: s.orgCountry,
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
