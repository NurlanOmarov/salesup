import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker standalone — БЕЗ serverless-специфики (CLAUDE.md, стек)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // argon2 — нативный модуль; не бандлить на сервере (Sprint 1)
  // geoip-lite НЕ в external: под pnpm авто-трейсинг не копирует его в standalone
  // node_modules → webpack бандлит его код, а .dat-базы даёт outputFileTracingIncludes
  // (+ global.geodatadir в lib/analytics/geo.ts указывает на них в рантайме).
  serverExternalPackages: ["@node-rs/argon2", "argon2", "pino"],
  // Server Actions по умолчанию режут тело на 1 МБ, а обложки/OG-картинки грузятся
  // через FormData и могут весить до 8 МБ (проверка размера — в actions.ts). Поднимаем
  // лимит, иначе Next отклоняет запрос ДО входа в action → 500 «Server Components render».
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Файлы, читаемые с диска в рантайме, — копируем в standalone-образ:
  //  • шрифты для PDF-сертификатов;
  //  • базы geoip-lite для /api/track (определение страны по IP, правило 9/10).
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/**"],
    "/api/track": ["./node_modules/geoip-lite/data/**"],
  },
  // Резолв ESM-style `.js`-импортов в TS-исходниках (lib/storage и др.):
  // webpack по умолчанию не сопоставляет .js → .ts, как это делает tsx/node ESM.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
