# edge/ — центральный reverse-proxy нового VPS

Владеет портами 80/443, терминирует TLS и маршрутизирует поддомены на проекты через
внешнюю docker-сеть `edge-net`. Живёт отдельным compose-проектом на сервере
(рекомендуется каталог `/home/administrator/infra`). Полный контекст — [../../docs/MIGRATION-RUNBOOK.md](../../docs/MIGRATION-RUNBOOK.md).

## Первичная настройка на сервере

```bash
# 0) общая сеть (один раз)
docker network create edge-net

# 1) скопировать этот каталог в /home/administrator/infra и войти в него
cd /home/administrator/infra

# 2) поднять edge. На этом шаге в conf.d/study.conf 443-блок должен быть ЗАКОММЕНТИРОВАН
#    (сертификата ещё нет) — оставляем только HTTP-блок с /.well-known/acme-challenge.
docker compose up -d edge

# 3) выпустить сертификат (DNS study.activesales.by уже должен указывать на этот сервер)
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d study.activesales.by \
  --email owner@activesales.by --agree-tos --no-eff-email

# 4) раскомментировать 443-блок в conf.d/study.conf и перечитать конфиг
docker compose exec edge nginx -t && docker compose exec edge nginx -s reload

# 5) поднять авто-продление
docker compose up -d certbot
```

## Проверки

```bash
docker compose exec edge nginx -t                 # синтаксис
curl -I https://study.activesales.by/api/health   # 200 + валидный TLS
docker compose run --rm certbot renew --dry-run   # авто-продление работает
```

## Добавление нового проекта-соседа

1. Подключить nginx проекта к сети `edge-net` с сетевым алиасом (как у SalesUp — `salesup-nginx`).
2. Добавить `conf.d/<проект>.conf` со своим `server_name` и `proxy_pass http://<alias>:80;`.
3. Выпустить сертификат для его поддомена (шаг 3) и `nginx -s reload`.

Проекты не публикуют свои порты на хост — только через edge. 80/443 не конфликтуют.
