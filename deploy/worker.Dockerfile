# syntax=docker/dockerfile:1
# Worker-контейнер: tsx-процесс (цикл Job + node-cron). Без сборки Next — запускает src напрямую.
FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
ENV NODE_ENV=production
# Точка входа воркера появится в S5.4 (src/worker/index.ts)
CMD ["pnpm", "tsx", "src/worker/index.ts"]
