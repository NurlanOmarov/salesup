import type { Metadata, Viewport } from "next";
import { env } from "@/env";
import "./globals.css";
import { ThemeScript } from "@/components/theme-script";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "SalesAcademy — курсы по продажам с AI-наставником",
    template: "%s · SalesAcademy",
  },
  description:
    "Онлайн-курсы по техникам продаж: видеоуроки, AI-тренажёр на материале тренера, тесты и сертификаты.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SalesAcademy" },
  // icon.svg подхватывается автоматически из src/app/icon.svg — дублировать не нужно
  icons: {
    apple: "/api/icon?size=180",
  },
  openGraph: {
    type: "website",
    siteName: "SalesAcademy",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "SalesAcademy — курсы по продажам с AI-наставником",
    description:
      "Онлайн-курсы по техникам продаж: видеоуроки, AI-тренажёр на материале тренера, тесты и сертификаты.",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

// Сайт-вайд разметка организации (Knowledge Panel, брендовая выдача).
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "SalesAcademy",
  url: env.NEXT_PUBLIC_SITE_URL,
  logo: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/icon.svg`,
  description:
    "Онлайн-курсы по техникам продаж с AI-наставником: видеоуроки, тренажёры, тесты и сертификаты.",
  areaServed: { "@type": "Country", name: "Kazakhstan" },
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
