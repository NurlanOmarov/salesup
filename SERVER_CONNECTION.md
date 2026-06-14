# SalesAcademy — Подключение к серверу и деплой

## Параметры сервера
- **Host:** `69.197.178.118`
- **User:** `administrator`
- **Port:** `4822` (стандартный 22 закрыт)
- **Auth:** Только SSH-ключи (парольный вход отключён)
- **ОС:** Ubuntu, Docker 29 + Compose v5

## Подключение
```bash
ssh -p 4822 administrator@69.197.178.118
```

## Структура на сервере
- **Проект:** `/home/administrator/salesup`
  - `docker-compose.prod.yml`, `nginx.http.conf`, `proxy_params.conf` — копируются деплоем
  - `.env` — генерируется деплоем из GitHub Secrets (chmod 600, не в git)
  - тома Docker: `salesup_pgdata` (БД), `salesup_media` (HLS/VTT/PDF от фабрики)
- **Центральный Nginx (других проектов):** `/home/administrator/labai/nginx/nginx.prod.conf` — **НЕ трогаем**
- **Документация сервера:** `/home/administrator/SERVER_GUIDE.md`

## Доступ к сервису
- **Домена нет** — доступ по IP и порту, поверх HTTP (без TLS).
- **URL:** `http://69.197.178.118:8444`
- Порты 80/443 заняты центральным `labai-nginx-1`, поэтому у salesup собственный nginx на **8444**.
- ⚠️ Без TLS cookie сессии помечаются НЕ-Secure (`AUTH_COOKIE_INSECURE=true`, D-007). При переезде на домен с HTTPS — выключить.

## Изоляция (другие проекты не страдают)
- salesup — **самодостаточный стек** в собственной bridge-сети; к `labai_labai-network` **НЕ подключается**.
- Биндит только порт **8444** (80/443 не трогает).
- Образы собираются в GitHub Actions и тянутся из GHCR — сервер **ничего не собирает** (нет риска OOM для соседей при ~1.6 ГБ свободной RAM).

## Docker-контейнеры salesup
| Контейнер | Описание | Память (limit) |
|-----------|----------|----------------|
| `salesup-db-1` | PostgreSQL 16 + pgvector | 768m |
| `salesup-app-1` | Next.js standalone (`node server.js`), внутренний :3000 | 640m |
| `salesup-worker-1` | tsx-воркер: цикл Job + node-cron (daily, weekly-digest) | 512m |
| `salesup-nginx-1` | nginx: reverse-proxy + X-Accel-Redirect медиа, внешний **8444** → 80 | — |

## Занятые порты на сервере (справка)
80, 443 (labai-nginx), 3000 (handoors), 3001 (dana-piano), 3002 (nuri), 3005 (ip-uchet),
3007 (docscan), 3010 (rankpapa), 8000/8085 (transfer), 8443 (kazakhstan_data), 4822 (SSH).
**Наш порт: 8444.**

## Деплой
- **Автоматический:** push в `main` → GitHub Actions (`.github/workflows/deploy.yml`):
  1. собирает образы `app`/`worker`, пушит в GHCR (`ghcr.io/nurlanomarov/salesup-*`);
  2. копирует инфра-файлы в `/home/administrator/salesup` (scp);
  3. по SSH: пишет `.env` из секретов → `docker login ghcr` → `compose pull` → миграции через worker → `compose up -d`.
- **Ручной (на сервере):**
```bash
cd /home/administrator/salesup
echo "$GHCR_PAT" | docker login ghcr.io -u NurlanOmarov --password-stdin
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env run --rm worker pnpm prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## Первичный сид владельца (один раз, вручную)
Учётка владельца и тестовые данные создаются сидом — НЕ входит в авто-деплой, чтобы не перезатирать.
```bash
cd /home/administrator/salesup
SEED_OWNER_PASSWORD='<надёжный-пароль>' \
docker compose -f docker-compose.prod.yml --env-file .env \
  run --rm -e SEED_OWNER_PASSWORD worker pnpm tsx prisma/seed.ts
```

## GitHub Actions — секреты (Settings → Secrets and variables → Actions)
| Секрет | Значение / Описание |
|--------|---------------------|
| `SERVER_HOST` | `69.197.178.118` |
| `SERVER_USER` | `administrator` |
| `SSH_PORT` | `4822` |
| `SSH_PRIVATE_KEY` | Приватный deploy-ключ `~/.ssh/github_actions_salesup` (ed25519) |
| `GHCR_USER` | `NurlanOmarov` (для pull приватных образов на сервере) |
| `GHCR_PAT` | GitHub PAT (classic) со скоупом `read:packages` |
| `POSTGRES_PASSWORD` | Пароль БД |
| `AUTH_SECRET` | Секрет сессий Auth.js (base64 32) |
| `ANTHROPIC_API_KEY` | Ключ Anthropic API |
| `EMBEDDINGS_API_KEY` | Ключ Voyage AI (voyage-3) |
| `VIDEO_SIGNING_SECRET` | HMAC-подпись URL HLS-сегментов |
| `VIDEO_KEY_ENC_SECRET` | Шифрование AES-ключей HLS в БД |
| `OWNER_EMAIL` | E-mail владельца |
| `NEXT_PUBLIC_SITE_URL` | `http://69.197.178.118:8444` (инлайнится в клиент при сборке!) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | `https://wa.me/77077721707` (публичная, инлайнится при сборке) |
| `NEXT_PUBLIC_SUPPORT_TELEGRAM` | `https://t.me/salesacademy_kz` (публичная) |
| `NEXT_PUBLIC_SUPPORT_PHONE` | `+7 707 772 17 07` (публичный) |

> `GITHUB_TOKEN` для push образов в GHCR создаётся автоматически (`packages: write`) — отдельный секрет не нужен.

## Медиа (видео/HLS) — деплой фабрикой
Образы и контент видео НЕ кладутся в git. Фабрика (локально) собирает HLS и rsync-ит в том `salesup_media`:
```bash
rsync -e 'ssh -p 4822' -avz ./media/courses/<slug>/ \
  administrator@69.197.178.118:/var/lib/docker/volumes/salesup_media/_data/courses/<slug>/
```
(точный путь тома: `docker volume inspect salesup_media`)

## Логи и обслуживание
```bash
cd /home/administrator/salesup
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker
docker stats --no-stream
```

## Бэкап БД (ПДн — шифровать, правило 9)
```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U salesacademy salesacademy | gzip > backup_$(date +%F).sql.gz
```

## Автозапуск
- `restart: unless-stopped` у всех сервисов.

---
*Создано 12.06.2026. Временный VPS (DatabaseMart); целевой — ps.kz/hoster.kz с переносом ПДн в РК (docs/MIGRATION.md).*
