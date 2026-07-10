# SalesAcademy — Подключение к серверу и деплой

> Актуальный сервер с **10.07.2026**: NAT-VPS Database Mart `93.127.131.216`, домен
> **https://study.activesales.by**. Старый сервер `69.197.178.118` (IP:8444) выведен и удалён.
> Переезд: `docs/MIGRATION-RUNBOOK.md`. Второй поддомен (.kz): `docs/MULTI-DOMAIN-PLAN.md`.

## Параметры сервера
- **Публичный IP:** `93.127.131.216` (шлюз-NAT провайдера)
- **Внутренний IP VPS:** `192.168.122.10` (сетевой интерфейс за NAT)
- **User:** `administrator`
- **SSH-порт:** `10042` (внешний) → провайдер пробрасывает на внутренний **22** (sshd слушает 22!)
- **Auth:** SSH-ключ `~/.ssh/salesup_deploy` (ed25519). Пароль есть, но вход по ключу.
- **ОС:** Ubuntu 24.04, Docker 29.6.1 + Compose v2

> ⚠️ **NAT-VPS:** внешние 80/443 держит шлюз провайдера; sshd — на внутр. 22 (внешний 10042).
> Если будешь включать `ufw` — открывать **22/tcp** (не 10042!) и **до** `--force enable`,
> иначе заблокируешь себе SSH (проверено на практике). См. «Усиление (TODO)».

## Подключение
```bash
ssh salesup-new                    # алиас в ~/.ssh/config
# или явно:
ssh -i ~/.ssh/salesup_deploy -p 10042 administrator@93.127.131.216
```

## Доступ к сервису (как заведён веб на NAT-VPS)
- **URL:** `https://study.activesales.by` (будущий второй: `study.activesales.kz`).
- Веб включён через панель Database Mart → **Website Management → «Add Domain»**:
  `study.activesales.by → IP 192.168.122.10, Port 80`. Шлюз провайдера **сам терминирует TLS**
  (Let's Encrypt) и форвардит HTTP на наш **edge-nginx** (внутр. :80).
- DNS: A-запись `study.activesales.by → 93.127.131.216` (NS домена — `ns1/2/3.activeby.net`).
- Порт-маппинг (нижний блок панели) — для не-веб сервисов; так сделан SSH `10042→22`.

## Архитектура на сервере
```
Интернет :443/:80
   │  (TLS Let's Encrypt на шлюзе провайдера, «Add Domain»)
   ▼
edge-nginx (compose-проект infra, ~/infra) — слушает VPS :80/:443, роутит по Host
   │  proxy → salesup-nginx:80 (общая docker-сеть edge-net), X-Forwarded-Proto=https
   ▼
salesup-nginx (проект salesup) — reverse-proxy + X-Accel-Redirect медиа → app:3000
```
- **edge-nginx:** `~/infra/` (docker-compose.yml, nginx.conf, conf.d/study.conf). Владеет 80/443.
- **salesup-nginx:** порт на хост НЕ публикует, входит в сеть `edge-net` под алиасом `salesup-nginx`.
- Сеть `edge-net` — общая внешняя (`docker network create edge-net`), для будущих соседей.

## Структура каталогов на сервере
- **Проект salesup:** `/home/administrator/salesup`
  - `docker-compose.prod.yml`, `nginx.http.conf`, `proxy_params.conf` — копируются деплоем
  - `.env` — генерируется деплоем из GitHub Secrets (chmod 600, не в git)
  - тома Docker: `salesup_pgdata` (БД+pgvector), `salesup_media` (HLS/VTT/PDF/аватары)
- **edge-nginx:** `/home/administrator/infra` (docker-compose проект `infra`)

## Docker-контейнеры
| Контейнер | Описание | Порт на хост |
|-----------|----------|--------------|
| `infra-edge-1` | edge-nginx: TLS-приём от шлюза, роутинг по Host | **80, 443** |
| `salesup-nginx-1` | nginx: reverse-proxy + X-Accel-Redirect медиа | нет (через edge-net) |
| `salesup-app-1` | Next.js standalone (`node server.js`), внутр. :3000 | нет |
| `salesup-worker-1` | tsx-воркер: цикл Job + node-cron (daily, weekly-digest) | нет |
| `salesup-db-1` | PostgreSQL 16 + pgvector | нет |

## Деплой (не изменился)
- **Автоматический:** push в `main` → GitHub Actions (`.github/workflows/deploy.yml`):
  1. собирает образы `app`/`worker`, пушит в GHCR (`ghcr.io/nurlanomarov/salesup-*`);
  2. копирует инфра-файлы в `/home/administrator/salesup` (scp);
  3. по SSH: пишет `.env` из секретов → `docker login ghcr` (по `GITHUB_TOKEN`) →
     `compose pull` → миграции через worker → `compose up -d` → `restart nginx`.
- **Ручной (на сервере):**
```bash
cd /home/administrator/salesup
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env run --rm worker pnpm prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml --env-file .env restart nginx   # пере-резолв app
```
- **edge-nginx** обновляется вручную (не входит в CI): править `~/infra/conf.d/*.conf` →
  `cd ~/infra && docker compose exec edge nginx -t && docker compose exec edge nginx -s reload`.

## Первичный сид владельца (один раз, вручную)
```bash
cd /home/administrator/salesup
SEED_OWNER_PASSWORD='<надёжный-пароль>' \
docker compose -f docker-compose.prod.yml --env-file .env \
  run --rm -e SEED_OWNER_PASSWORD worker pnpm tsx prisma/seed.ts
```
> При переезде БД перенесена целиком — сид не требуется (владелец `omarov.nb@gmail.com` уже в базе).

## GitHub Actions — секреты (Settings → Secrets and variables → Actions)
| Секрет | Значение / Описание |
|--------|---------------------|
| `SERVER_HOST` | `93.127.131.216` |
| `SERVER_USER` | `administrator` |
| `SSH_PORT` | `10042` |
| `SSH_PRIVATE_KEY` | Приватный deploy-ключ (ed25519), пара к `~/.ssh/salesup_deploy` |
| `POSTGRES_PASSWORD` | Пароль БД |
| `AUTH_SECRET` | Секрет сессий Auth.js (base64 32) |
| `ANTHROPIC_API_KEY` | Ключ Anthropic API |
| `EMBEDDINGS_API_KEY` | Ключ embeddings (OpenAI text-embedding-3-small, D-001) |
| `VIDEO_SIGNING_SECRET` | HMAC-подпись URL HLS-сегментов |
| `VIDEO_KEY_ENC_SECRET` | Шифрование AES-ключей HLS в БД |
| `OWNER_EMAIL` | E-mail владельца |
| `NEXT_PUBLIC_SITE_URL` | `https://study.activesales.by` (инлайнится в клиент при сборке!) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` / `_TELEGRAM` / `_PHONE` | Публичные контакты (инлайнятся при сборке) |

> - `GITHUB_TOKEN` для push/pull образов в GHCR создаётся автоматически (`packages: write/read`).
>   Отдельные `GHCR_PAT` / `GHCR_USER` больше **не используются**.
> - В `.env` на сервере деплой также пишет: `AUTH_URL=https://study.activesales.by`
>   (канон. базовый URL Auth.js за прокси), `AUTH_COOKIE_INSECURE=false`, `STORAGE_DRIVER=fs`,
>   `VOICE_ENABLED=true`, `AVATAR_ENABLED=true`, `EMAIL_ENABLED=false`.

## Медиа (видео/HLS) — деплой фабрикой
Контент видео НЕ в git. Фабрика (локально) собирает HLS и публикует в том `salesup_media`.
Параметры — в `.env.deploy` (не в git): `DEPLOY_HOST=administrator@93.127.131.216`,
`DEPLOY_SSH_PORT=10042`. Прямой rsync в том (нужен root на сервере):
```bash
rsync -e 'ssh -p 10042' -avz --rsync-path='sudo rsync' ./media/courses/<slug>/ \
  administrator@93.127.131.216:/var/lib/docker/volumes/salesup_media/_data/courses/<slug>/
```
(точный путь тома: `docker volume inspect salesup_media`)

## Логи и обслуживание
```bash
cd /home/administrator/salesup
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker
docker stats --no-stream
cd ~/infra && docker compose logs -f edge          # edge-nginx
```

## Бэкап БД (ПДн — шифровать/хранить безопасно, правило 9)
```bash
cd /home/administrator/salesup
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U salesacademy -Fc salesacademy > backup_$(date +%F).dump
```
Финальный бэкап старого сервера (перед его удалением): `~/salesup-old-final-backup/` (локально).

## Усиление сервера (TODO — отложено намеренно)
Пока НЕ включены `ufw` и `fail2ban` (чтобы не заблокироваться при переносе). При включении:
- `ufw allow 22/tcp` (внутренний порт sshd!) + `80`, `443` → **потом** `ufw --force enable`
  (со страховкой `echo 'ufw disable' | at now+5min`, проверить доступ вторым соединением).
- `fail2ban` сразу с `ignoreip` рабочего IP.

## Автозапуск
- `restart: unless-stopped` у всех сервисов (salesup и edge).

---
*Обновлено 10.07.2026 — переезд на NAT-VPS Database Mart (93.127.131.216), домен study.activesales.by. Старый сервер удалён.*
