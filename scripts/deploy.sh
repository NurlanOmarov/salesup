#!/usr/bin/env bash
# УСТАРЕВШИЙ путь деплоя: сборка образов НА СЕРВЕРЕ (rsync исходников + docker compose build).
#
# ⚠️ Боевой деплой идёт через GitHub Actions (.github/workflows/deploy.yml):
#      git push origin main  →  CI собирает образы → GHCR → сервер делает pull + up.
#    Сервер Next.js не собирает (мало RAM), а инфра-файлы (docker-compose.prod.yml,
#    nginx.http.conf, proxy_params.conf) CI сам кладёт в корень каталога проекта.
#
# Скрипт оставлен для стенда, где образы собираются на месте, и по умолчанию НЕ запускается.
# Запуск: ALLOW_LEGACY_DEPLOY=1 bash scripts/deploy.sh
#
# Грабли, из-за которых появился этот запрет (2026-07-20):
#   • без -p имя compose-проекта берётся из каталога («deploy») → поднимается ВТОРОЙ стек
#     со своими томами вместо обновления боевого, и он падает на занятом порту 80;
#   • rsync --delete сносит из корня проекта файлы, которые туда кладёт CI, а не git.
#
# Переменные окружения скрипта (или .env.deploy):
#   DEPLOY_HOST   — user@ip VPS
#   DEPLOY_PATH   — каталог проекта на VPS
#   NGINX_CONF    — ./nginx.http.conf (без TLS) | ./nginx.conf (с TLS)
#   COMPOSE_PROJECT — имя compose-проекта боевого стека (default: salesup)
set -euo pipefail

if [ "${ALLOW_LEGACY_DEPLOY:-}" != "1" ]; then
  cat >&2 <<'MSG'
✗ scripts/deploy.sh — устаревший путь (сборка на сервере).
  Боевой деплой: git push origin main → GitHub Actions → GHCR → pull на сервере.
  Точечно перезапустить прод: ssh <host> 'cd <path> && docker compose -f docker-compose.prod.yml --env-file .env up -d'
  Если действительно нужен legacy-путь: ALLOW_LEGACY_DEPLOY=1 bash scripts/deploy.sh
MSG
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# shellcheck disable=SC1091
[ -f .env.deploy ] && source .env.deploy

: "${DEPLOY_HOST:?DEPLOY_HOST не задан (user@ip)}"
: "${DEPLOY_PATH:?DEPLOY_PATH не задан}"
NGINX_CONF="${NGINX_CONF:-./nginx.http.conf}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
# Имя compose-проекта боевого стека (контейнеры salesup-app-1 и т.д.). См. .env.deploy.
COMPOSE_PROJECT="${COMPOSE_PROJECT:-salesup}"
HEALTH_URL="${HEALTH_URL:-http://<ip>/api/health}"

echo "▶ Проверки перед деплоем (lint, typecheck, test)…"
pnpm lint
pnpm typecheck
pnpm test

echo "▶ Синхронизация исходников на ${DEPLOY_HOST}:${DEPLOY_PATH}…"
rsync -az --delete \
  -e "ssh -p ${DEPLOY_SSH_PORT}" \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude media --exclude '.env*' --exclude out \
  --exclude docker-compose.prod.yml --exclude nginx.http.conf --exclude proxy_params.conf \
  ./ "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "▶ Сборка и запуск на VPS…"
ssh -p "${DEPLOY_SSH_PORT}" "${DEPLOY_HOST}" COMPOSE_PROJECT="${COMPOSE_PROJECT}" bash -s <<EOF
set -euo pipefail
cd "${DEPLOY_PATH}/deploy"
export NGINX_CONF="${NGINX_CONF}"
# -p ${COMPOSE_PROJECT}: без явного имени проект берётся из имени каталога («deploy»),
# и compose поднимает ВТОРОЙ параллельный стек со своими томами вместо обновления
# боевого (тот создан с именем salesup). Порт 80 занят живым nginx — деплой падает,
# а рядом остаются лишние app/db/worker. Имя проекта фиксируем явно.
docker compose -p "${COMPOSE_PROJECT}" --env-file ../.env up -d --build
# применяем миграции БД (idempotent)
docker compose -p "${COMPOSE_PROJECT}" --env-file ../.env run --rm app pnpm prisma migrate deploy || true
docker compose -p "${COMPOSE_PROJECT}" ps
EOF

echo "✅ Деплой завершён. Проверь ${HEALTH_URL}"
