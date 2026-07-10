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
  icons: {
    icon: "/icon.svg",
    apple: "/api/icon?size=180",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
