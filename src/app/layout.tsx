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
    // icon.svg подхватывается автоматически из src/app/icon.svg — дублировать не нужно
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
  const sameAs = socialLinks(s);
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Бизнес-платформа ACTIVE SALES",
    url: env.NEXT_PUBLIC_SITE_URL,
    logo: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/icon.svg`,
    description:
      "Онлайн-курсы по техникам продаж с AI-наставником: видеоуроки, тренажёры, тесты и сертификаты.",
    areaServed: { "@type": "Country", name: "Kazakhstan" },
    ...(sameAs.length ? { sameAs } : {}),
    ...(env.NEXT_PUBLIC_SUPPORT_PHONE
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: env.NEXT_PUBLIC_SUPPORT_PHONE,
            contactType: "customer support",
            areaServed: "KZ",
            availableLanguage: ["Russian", "Kazakh"],
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
