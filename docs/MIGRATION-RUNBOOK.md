# MIGRATION-RUNBOOK.md — перенос SalesUp на новый VPS (93.127.131.216)

> Конкретный исполняемый runbook переезда с текущего общего VPS (DatabaseMart,
> `69.197.178.118:4822`, nginx на порту 8444, IP-only) на новый выделенный
> Ubuntu-VPS `93.127.131.216:10042` с **центральным edge-reverse-proxy**,
> поддоменом **study.activesales.by** и TLS. Каркас концепции — [MIGRATION.md](MIGRATION.md).

## 0. Вводные

| | Старый сервер | Новый сервер |
|---|---|---|
| IP | 69.197.178.118 | **93.127.131.216** |
| SSH-порт | 4822 | **10042** |
| Пользователь | administrator | **administrator** (пароль выдан отдельно — заменить на ключ) |
| Каталог проекта | /home/administrator/salesup | /home/administrator/salesup |
| edge-proxy | — | /home/administrator/infra |
| Внешний доступ | http://IP:8444 (labai-nginx занимает 80/443) | **https://study.activesales.by** через edge-nginx |
| ОС | — | Ubuntu (чистая установка) |

**Что переносим (всё состояние — в 2 Docker-томах):**
- `salesup_pgdata` — PostgreSQL 16 + pgvector (ученики, прогресс, эмбеддинги, зашифрованные AES-ключи HLS).
- `salesup_media` — HLS/VTT/PDF/аватары. Может быть большим (~1 ГБ на час видео) → синхронизируем заранее.

**Как деплоится сервис (не меняется):** пуш в `main` / `workflow_dispatch` → GitHub Actions
собирает образы app/worker → GHCR → сервер `pull` + `compose up` + `prisma migrate deploy`.
`.env` на сервере генерируется из GitHub Secrets на каждый деплой. Переезд = сменить 3 секрета
(адрес/порт/ключ сервера) + перелить 2 тома.

> ⚠️ Секреты `AUTH_SECRET`, `VIDEO_SIGNING_SECRET`, `VIDEO_KEY_ENC_SECRET`, `POSTGRES_PASSWORD`
> **не меняем** — иначе расшифровка AES-ключей видео и сессии сломаются. Переносим те же значения.

**Статус DNS:** A-запись `study.activesales.by → 93.127.131.216` уже добавлена и разошлась
(`dig +short study.activesales.by` возвращает нужный IP). NS домена — `ns1/2/3.activeby.net`.

---

## 1. Целевая архитектура

Новый VPS хостит несколько проектов, поэтому 80/443 отдаём **общему edge-nginx**, а каждый
проект прячем за ним по поддомену:

```
Интернет :443/:80
      │
      ▼
┌─────────────────────────────┐   compose-проект /home/administrator/infra  (deploy/edge/)
│  edge-nginx  (TLS, certbot) │   владеет 80/443, роутит по Host:
│  study.activesales.by ──────┼──► salesup-nginx:80  (docker-сеть edge-net)
│  проект2.<домен> ───────────┼──► ...
└─────────────────────────────┘
      shared external network: edge-net
```

- **edge-nginx** (`deploy/edge/`) терминирует TLS, маршрутизирует по поддомену. Про X-Accel/media не знает.
- **Внутренний nginx SalesUp** (`deploy/nginx.http.conf`) остаётся (X-Accel-Redirect для
  `/protected-media/`, rate-limit зоны, проксирование на `app:3000`), но **больше не публикует
  порт на хост** — подключается к сети `edge-net` под алиасом `salesup-nginx`.
- Новый проект = +1 server-блок в `deploy/edge/conf.d/` + подключение его nginx к `edge-net`.

> Правки в репозитории под эту схему уже внесены (эта ветка): `deploy/docker-compose.prod.yml`
> (nginx без `ports`, сеть `edge-net`), `deploy/nginx.http.conf` + `deploy/proxy_params.conf`
> (проброс `X-Forwarded-Proto` от edge), `deploy/edge/*` (конфиги edge), `deploy.yml`
> (`AUTH_COOKIE_INSECURE=false`).

---

## 2. Подготовка нового сервера (за 1–2 дня до окна)

Вход по паролю (порт 10042), затем сразу переводим на ключи.

```bash
ssh -p 10042 administrator@93.127.131.216
```

### 2.1 Базовое усиление (P0.1)
```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Almaty

# SSH-ключи вместо пароля
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAA...твой_админ_ключ" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# после проверки входа по ключу — выключить пароль:
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Firewall + fail2ban
sudo apt -y install ufw fail2ban
sudo ufw allow 10042/tcp        # SSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 2.2 Docker + Compose
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker administrator     # перелогиниться
docker --version && docker compose version
```

### 2.3 Своп (правило 10, если VPS маленький)
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.4 Каталоги
```bash
mkdir -p /home/administrator/salesup /home/administrator/infra
```

---

## 3. Центральный edge-reverse-proxy

Конфиги — в репозитории: `deploy/edge/` (docker-compose.yml, nginx.conf, conf.d/study.conf, README.md).

```bash
docker network create edge-net                     # общая внешняя сеть (один раз)
# скопировать deploy/edge/* → /home/administrator/infra/ и следовать deploy/edge/README.md
```

Порядок (из `deploy/edge/README.md`): поднять edge с HTTP-блоком → выпустить сертификат
(шаг 7.1, DNS уже готов) → раскомментировать 443-блок → `nginx -s reload` → поднять certbot-автопродление.

---

## 4. DNS — уже сделано ✅

A-запись добавлена у `activeby.net` (NS домена):

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | `study` | `93.127.131.216` | 300 |

Проверка: `dig +short study.activesales.by` → `93.127.131.216`. После стабилизации вернуть TTL к 3600.

---

## 5. Обновление GitHub Secrets и workflow

GitHub → Settings → Secrets and variables → Actions:

| Секрет | Было | Стало |
|--------|------|-------|
| `SERVER_HOST` | 69.197.178.118 | **93.127.131.216** |
| `SSH_PORT` | 4822 | **10042** |
| `SSH_PRIVATE_KEY` | ключ старого | **новый deploy-ключ** (см. ниже) |
| `SERVER_USER` | administrator | без изменений |
| `NEXT_PUBLIC_SITE_URL` | http://IP:8444 | **https://study.activesales.by** |
| `AUTH_SECRET`, `VIDEO_SIGNING_SECRET`, `VIDEO_KEY_ENC_SECRET`, `POSTGRES_PASSWORD`, `ANTHROPIC_API_KEY`, `EMBEDDINGS_API_KEY`, `OWNER_EMAIL` | — | **НЕ менять** |

> `AUTH_COOKIE_INSECURE` уже переключён в `deploy.yml` на `false` (за TLS). Отдельного секрета не требует.

Deploy-ключ для CI (на своей машине):
```bash
ssh-keygen -t ed25519 -f salesup_deploy -N "" -C "gh-actions@salesup"
ssh -p 10042 administrator@93.127.131.216 \
  'echo "'"$(cat salesup_deploy.pub)"'" >> ~/.ssh/authorized_keys'
# приватный (salesup_deploy) → секрет SSH_PRIVATE_KEY, затем удалить локально
```

Локально обновить **`.env.deploy`** (для `pnpm factory:publish`, rsync медиа):
```
DEPLOY_HOST=administrator@93.127.131.216
DEPLOY_SSH_PORT=10042
# DEPLOY_DB_CONTAINER / DEPLOY_MEDIA_CONTAINER — те же (salesup-db-1 / salesup-worker-1)
```

---

## 6. Перенос данных

### 6.1 Предсинхронизация медиа (без простоя, за день; повторять до окна)
```bash
OLD=administrator@69.197.178.118 ; NEW=administrator@93.127.131.216
ssh -p 4822 $OLD 'sudo tar -C /var/lib/docker/volumes/salesup_media/_data -czf - .' \
  | ssh -p 10042 $NEW 'mkdir -p ~/media_seed && tar -C ~/media_seed -xzf -'
```
Повторять до окна — дельты минутные.

### 6.2 Окно переезда (простой ≈ время дампа+restore БД, обычно ≤10 мин)

**На СТАРОМ — финальный дамп БД + дельта медиа:**
```bash
ssh -p 4822 administrator@69.197.178.118
cd /home/administrator/salesup
docker compose -f docker-compose.prod.yml stop app worker      # maintenance (db оставляем)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U salesacademy -Fc salesacademy > /tmp/salesup.dump
```
Скопировать дамп и добить дельту медиа на новый сервер (повторить 6.1).

**На НОВОМ — восстановить тома:**
```bash
scp -P 4822 administrator@69.197.178.118:/tmp/salesup.dump ~/salesup.dump

cd /home/administrator/salesup            # сюда workflow зальёт compose/nginx; для ручного старта — скопировать из репо
docker compose -f docker-compose.prod.yml --env-file .env up -d db   # создаёт том salesup_pgdata
docker compose -f docker-compose.prod.yml exec db pg_isready -U salesacademy

docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U salesacademy -d salesacademy --clean --if-exists < ~/salesup.dump

docker run --rm -v salesup_media:/data -v ~/media_seed:/seed alpine \
  sh -c 'cp -a /seed/. /data/'
```
> Имя тома = `<имя-каталога-с-compose>_<volume>` → `salesup_pgdata`, `salesup_media`.
> Проверить: `docker volume ls | grep salesup`. Обе стороны — `pgvector/pgvector:pg16`, дамп совместим.

---

## 7. Запуск, TLS и smoke-тест

### 7.1 Выпустить сертификат (DNS уже готов)
Следовать `deploy/edge/README.md`: edge поднят с HTTP-блоком →
```bash
cd /home/administrator/infra
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d study.activesales.by --email owner@activesales.by --agree-tos --no-eff-email
# раскомментировать 443-блок conf.d/study.conf
docker compose exec edge nginx -t && docker compose exec edge nginx -s reload
docker compose up -d certbot
```

### 7.2 Деплой SalesUp
Запустить GitHub Actions **Deploy** (`workflow_dispatch`). Он соберёт образы с новым
`NEXT_PUBLIC_SITE_URL=https://study.activesales.by`, сгенерит `.env`, `pull`,
`prisma migrate deploy` (на восстановленной БД — no-op), `up -d`, `restart nginx`.

### 7.3 Smoke-чеклист (обязательный, из CLAUDE.md)
- [ ] `https://study.activesales.by/api/health` → ok, TLS валиден (замок).
- [ ] Логин выданным паролем; форс-смена временного пароля.
- [ ] Урок: playlist грузится, сегмент видео отдаётся (X-Accel-Redirect), AES-ключ выдаётся.
- [ ] Прямой запрос сегмента/ключа/playlist **без enrollment → 403**.
- [ ] Переключение субтитров RU/KK/EN/UZ.
- [ ] Тест урока + порог/пересдача; сертификат + `/verify/<id>`.
- [ ] Админка: создание ученика + выдача доступа.
- [ ] AI-чат (RAG); голос/аватар если включены (`VOICE_ENABLED`/`AVATAR_ENABLED`).
- [ ] Cookie сессии `Secure` (DevTools → Application → Cookies).
- [ ] `docker compose logs` без ошибок; worker крутит Job/cron.

---

## 8. Откат
- Домен-поддомен новый, старый сервер работал по IP:8444 → трафик на новый не «переключался»,
  а направлен сразу. При проблемах на новом — правим на месте; ученикам временно даём
  `http://69.197.178.118:8444`.
- **Не гасим старый сервер** 24–48 ч после подтверждения.

## 9. После переезда
- [ ] Новый сервер — в расписание бэкапов (ночной `pg_dump` + rsync медиа, S6.3).
- [ ] `certbot renew --dry-run` — авто-продление TLS.
- [ ] Мониторинг логов 24 ч; вернуть DNS TTL к 3600.
- [ ] Старый VPS read-only 1–2 недели → затем **затереть тома с ПДн** (правило 9).
- [ ] `.env.deploy`, заметки, `docs/` — обновить адрес сервера.

## 10. Чек-лист готовности перед окном
- [ ] Новый сервер: ключи, ufw (80/443/10042), Docker, swap, каталоги.
- [ ] edge-nginx + `edge-net` подняты; сертификат `study.activesales.by` выпущен.
- [ ] Ветка `feat/migrate-new-vps` смёржена в `main` (правки compose/nginx/workflow/edge).
- [ ] DNS `study.activesales.by → 93.127.131.216` (проверено `dig`). ✅
- [ ] GitHub Secrets обновлены (HOST/PORT/KEY/SITE_URL).
- [ ] Медиа предсинхронизировано; замерено время финальной дельты.
- [ ] `.env.deploy` локально обновлён.
- [ ] Тестовый прогон `pg_restore` из дампа проверен.
