# syntax=docker/dockerfile:1
# Multi-stage build для Next.js standalone (CLAUDE.md: next start в Docker, output standalone).

# ─── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
# openssl нужен Prisma; build-essential — для нативных модулей (argon2 в Sprint 1)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── builder ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* инлайнятся в клиентский бандл на этапе build (env.ts/clientSchema) —
# их РЕАЛЬНЫЕ значения передаются как build-args из CI (.github/workflows/deploy.yml).
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SUPPORT_WHATSAPP=
ARG NEXT_PUBLIC_SUPPORT_TELEGRAM=
ARG NEXT_PUBLIC_SUPPORT_PHONE=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPPORT_WHATSAPP=$NEXT_PUBLIC_SUPPORT_WHATSAPP \
    NEXT_PUBLIC_SUPPORT_TELEGRAM=$NEXT_PUBLIC_SUPPORT_TELEGRAM \
    NEXT_PUBLIC_SUPPORT_PHONE=$NEXT_PUBLIC_SUPPORT_PHONE

# Серверные секреты при сборке НЕ нужны (читаются из process.env в рантайме), но
# env.ts валидирует их при импорте во время `next build` — даём фиктивные значения
# ПРЯМО в команде (не ENV-слой → не попадают в образ и не триггерят сканер секретов).
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build_dummy_secret_min_16_chars \
    ANTHROPIC_API_KEY=build-dummy \
    EMBEDDINGS_API_KEY=build-dummy \
    MEDIA_ROOT=/media \
    VIDEO_SIGNING_SECRET=build_dummy_secret_min_16 \
    VIDEO_KEY_ENC_SECRET=build_dummy_secret_min_16 \
    OWNER_EMAIL=build@example.kz \
    pnpm build

# ─── runner ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# standalone-сборка + статика + Prisma-схема (схема — для справки/CMD-обёрток).
# Prisma client и query-engine уже включены Next-ом в .next/standalone через output
# file tracing (под pnpm они лежат в node_modules/.pnpm/... — ручной COPY .prisma/@prisma
# не нужен и ломается на pnpm-симлинках).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
