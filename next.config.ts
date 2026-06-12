import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker standalone — БЕЗ serverless-специфики (CLAUDE.md, стек)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // argon2 — нативный модуль; не бандлить на сервере (Sprint 1)
  serverExternalPackages: ["@node-rs/argon2", "argon2", "pino"],
};

export default nextConfig;
