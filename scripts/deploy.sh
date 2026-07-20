#!/usr/bin/env bash
# Деплой на VPS: build локально → rsync исходников → ssh docker compose up.
# CLAUDE.md: pnpm deploy. На временном VPS работаем по IP:порту без домена (nginx.http.conf).
#
# Переменные окружения скрипта (или .env.deploy):
#   DEPLOY_HOST   — user@ip временного VPS
#   DEPLOY_PATH   — каталог проекта на VPS (напр. /srv/salesacademy)
#   NGINX_CONF    — ./nginx.http.conf на временном стенде | ./nginx.conf на боевом
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# shellcheck disable=SC1091
[ -f .env.deploy ] && source .env.deploy

: "${DEPLOY_HOST:?DEPLOY_HOST не задан (user@ip)}"
: "${DEPLOY_PATH:?DEPLOY_PATH не задан}"
NGINX_CONF="${NGINX_CONF:-./nginx.http.conf}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"

echo "▶ Проверки перед деплоем (lint, typecheck, test)…"
pnpm lint
pnpm typecheck
pnpm test

echo "▶ Синхронизация исходников на ${DEPLOY_HOST}:${DEPLOY_PATH}…"
rsync -az --delete \
  -e "ssh -p ${DEPLOY_SSH_PORT}" \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude media --exclude '.env*' --exclude out \
  ./ "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "▶ Сборка и запуск на VPS…"
ssh -p "${DEPLOY_SSH_PORT}" "${DEPLOY_HOST}" bash -s <<EOF
set -euo pipefail
cd "${DEPLOY_PATH}/deploy"
export NGINX_CONF="${NGINX_CONF}"
docker compose --env-file ../.env up -d --build
# применяем миграции БД (idempotent)
docker compose --env-file ../.env run --rm app pnpm prisma migrate deploy || true
docker compose ps
EOF

echo "✅ Деплой завершён. Проверь http://<ip>/api/health"
