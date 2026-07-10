import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA): «Установить на экран» на мобильных (рынок КЗ — мобильный).
 * Иконки генерируются роутом /api/icon (PNG, в т.ч. maskable под Android-маски).
 * start_url ведёт сразу в кабинет ученика.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalesAcademy — курсы по продажам",
    short_name: "SalesAcademy",
    description:
      "Видеоуроки по продажам с AI-наставником, тренажёрами, тестами и сертификатами.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "ru",
    categories: ["education", "business"],
    icons: [
      { src: "/api/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/icon?size=192&maskable=1", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/api/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
