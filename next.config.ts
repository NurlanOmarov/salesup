import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker standalone — БЕЗ serverless-специфики (CLAUDE.md, стек)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // argon2 — нативный модуль; не бандлить на сервере (Sprint 1)
  serverExternalPackages: ["@node-rs/argon2", "argon2", "pino"],
  // Шрифты для PDF-сертификатов (читаются с диска в рантайме) — копируем в standalone.
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/**"],
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
