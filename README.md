# SalesAcademy

Платформа онлайн-курсов по продажам с AI-наставником. Полное описание — [docs/TZ.md](docs/TZ.md), план работ — [docs/BACKLOG.md](docs/BACKLOG.md), архитектурные решения — [docs/DECISIONS.md](docs/DECISIONS.md). Конвенции для разработки — [CLAUDE.md](CLAUDE.md).

## Локальная разработка

Требования: Node 20+, pnpm 10, Docker (для PostgreSQL+pgvector).

```bash
# 1. Зависимости
pnpm install

# 2. Локальная БД (PostgreSQL 16 + pgvector в Docker на порту 5433)
docker run -d --name salesup-db-dev \
  -e POSTGRES_USER=salesacademy -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=salesacademy -p 5433:5432 pgvector/pgvector:pg16

# 3. Окружение: скопировать образец и заполнить (DATABASE_URL уже указывает на :5433)
cp .env.example .env   # затем выставить секреты; для локалки см. значения ниже

# 4. Миграции + сиды
pnpm db:migrate
pnpm db:seed

# 5. Запуск
pnpm dev            # http://localhost:3000
```

Локальные учётки после сидов: владелец `omarov.nb@gmail.com` (пароль из `SEED_OWNER_PASSWORD`), ученик `student@example.kz` (пароль из `SEED_STUDENT_PASSWORD`, потребует смены).

## Проверки

```bash
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest (unit)
pnpm test:e2e      # Playwright (поднимает прод-сборку)
pnpm build         # production build
```

## Деплой (временный VPS по IP, без домена)

См. [docs/DECISIONS.md](docs/DECISIONS.md) D-007. Коротко: на VPS используется `deploy/nginx.http.conf` (без TLS) и `AUTH_COOKIE_INSECURE=true`.

```bash
# на VPS, в каталоге deploy/:
NGINX_CONF=./nginx.http.conf docker compose --env-file ../.env up -d --build
# проверка: curl http://<ip>/api/health
```

Переезд в РК и переход на домен+TLS — [docs/MIGRATION.md](docs/MIGRATION.md).
