# CLAUDE.md — Бизнес-платформа ACTIVE SALES (v1.2 «Автопилот / Один сервер»)

Платформа онлайн-курсов по продажам, работающая **без участия преподавателя**: «фабрика курсов» (CLI) собирает курсы из YouTube-записей, AI-критик валидирует контент, AI-наставник отвечает ученикам, владелец читает еженедельный дайджест. В MVP **нет онлайн-оплаты**: админ вручную создаёт ученика и выдаёт логин/пароль после устного подтверждения оплаты. Видео и все сервисы — на одном VPS. Рынок: Беларусь (решение владельца, 2026-07-16; ⚠️ упоминания закона РК о ПДн и целевого хостинга ps.kz ниже ждут ревизии), язык интерфейса: русский; субтитры видео: RU / KK / EN / UZ.

Полное ТЗ: `docs/TZ.md`. Backlog: `docs/BACKLOG.md`. Решения: `docs/DECISIONS.md`.

## Главные принципы

1. **Zero-touch для контента.** Ни одна фича не создаёт очередь задач для человека: генерацию валидирует AI-критик, плохое чинит фидбек-петля (≥2 дизлайков → авто-регенерация), вопросы без ответа в материале логируются в ContentGap (дайджест), а не назначаются кому-то. Единственные ручные операции — у владельца: создать ученика, выдать доступ, опубликовать курс, прочитать дайджест.
2. **Один сервер, без сторонних сервисов.** Всё (приложение, PostgreSQL+pgvector, nginx, видео, cron-воркер) — в Docker Compose на одном VPS. Внешние зависимости: ТОЛЬКО LLM API (Anthropic) и embeddings (OpenAI text-embedding-3-small, D-001). Аналитика: источник истины — своя таблица Event; внешние счётчики (GA4/Метрика) допустимы только на публичных страницах как маркетинговый слой (D-002). Сейчас VPS — DatabaseMart (временно); целевой — ps.kz / hoster.kz. ⚠️ Закон РК о ПДн требует хранения базы с персональными данными на территории РК — поэтому на временном VPS минимизируем ПДн (см. правило 9) и держим миграцию готовой.
3. **Готовность к миграции (Б → А).** Хранилище медиа — через абстракцию `lib/storage` (драйвер `fs` сейчас, `s3` потом): код везде оперирует относительными ключами (`courses/<slug>/lessons/<id>/...`), никогда — абсолютными путями. Переезд = pg_dump + rsync медиа + docker compose up на новом сервере (+смена драйвера на s3 при желании). Runbook в `docs/MIGRATION.md`.

## Стек

- **Next.js 15** (App Router, TS strict, RSC), запуск `next start` в Docker (standalone output) — БЕЗ serverless-специфики
- **Tailwind CSS 4 + shadcn/ui + Framer Motion**
- **PostgreSQL 16 + pgvector** — контейнер на том же VPS; **Prisma**
- **Auth.js v5, Credentials-провайдер**: логин/пароль; пароли — argon2id; учётки создаёт админ (генерация временного пароля, mustChangePassword при первом входе). Google OAuth и OTP — НЕ в MVP
- **nginx** (контейнер): TLS (certbot), reverse-proxy на app, отдача HLS-медиа через **X-Accel-Redirect** (см. правило 3), rate-limit зоны
- **Видео**: yt-dlp + FFmpeg (локально у владельца) → HLS AES-128 (720p+480p) → rsync на VPS в volume `media/`; плеер **hls.js**; AES-ключ — только через авторизованный эндпоинт
- **Субтитры**: VTT-дорожки RU/KK/EN/UZ per-урок (перевод транскрипта LLM-ом в фабрике, валидация критиком), переключатель в плеере
- **LLM: Anthropic API** — Haiku (чат, проверки, критик, переводы), Sonnet (генерация). Embeddings: **OpenAI text-embedding-3-small, dimensions=1024, cosine** (решение D-001 в docs/DECISIONS.md)
- **Фоновые задачи**: контейнер worker (tsx-процесс): цикл обработки таблицы Job (FOR UPDATE SKIP LOCKED) + node-cron расписания (daily, weekly-digest). Без Redis
- **E-mail (некритично в MVP)**: nodemailer → SMTP. Доступы выдаются админом лично, сброс пароля — через админа; письма используются только для уведомлений и могут быть выключены флагом `EMAIL_ENABLED`
- **CLI «фабрика курсов»**: `scripts/factory/*` (tsx, Node-окружение, локально; touch-команды деплоя медиа через rsync/ssh)
- **Zod**, **Vitest**, **Playwright**; Sentry self-hosted НЕ ставим в MVP — ошибки в файл-лог + pino, просмотр через `docker logs` / дайджест

## Команды

```bash
pnpm dev | build | lint | typecheck | test | test:e2e
pnpm db:migrate | db:studio | db:seed
docker compose up -d            # на VPS: app, db, nginx, worker
pnpm deploy                     # build → rsync → ssh restart (scripts/deploy.sh)
# Фабрика (локально):
pnpm factory:ingest <playlistUrl> --course <slug>    # курс под ключ (видео+контент+субтитры)
pnpm factory:video <videoUrl> --lesson <id>          # yt-dlp → HLS AES → rsync на VPS
pnpm factory:subs <lessonId> --langs kk,en,uz        # перевод и генерация VTT
pnpm factory:regen <lessonId> --type quiz|summary|subs
pnpm factory:validate <courseSlug>
```

## Структура

```
src/app/
  (marketing)/        # лендинг, /courses, /courses/[slug], /verify/[id]
  (auth)/login        # вход по логину/паролю; смена временного пароля
  (student)/app/      # dashboard, learn/[courseSlug]/[lessonId], certificates, settings
  (owner)/admin/      # students (создание+выдача доступов!), courses, flags, analytics
  api/                # video/{playlist,key,media}/..., ai/chat, health
src/lib/
  access.ts           # ЕДИНСТВЕННОЕ место проверки доступа
  storage/            # index.ts (интерфейс) + fs.ts (сейчас) + s3.ts (заглушка для миграции)
  video/              # hls-rewrite.ts, keys.ts
  ai/                 # anthropic.ts, rag.ts, critic.ts, translate.ts, limits.ts, prompts/
  jobs/               # enqueue() + обработчики; запускается в worker-контейнере
scripts/factory/  scripts/deploy.sh  prisma/  docs/  emails/
deploy/  # docker-compose.yml, nginx.conf, Dockerfile, crontab-заметки
```

## Конвенции

- UI — русский; код/коммиты — английский. Деньги в tiyn (Int) — поля сохранены в схеме для будущего платёжного модуля. ID — cuid, slug — kebab-case.
- RSC по умолчанию; мутации — Server Actions через `safeAction` (auth+zod+ошибки). Логика в `lib/`, enum-ы из Prisma.
- Медиа-файлы адресуются ТОЛЬКО относительным ключом через `lib/storage`; запрещено `fs.readFile('/var/...')` в src/.
- Фича = ветка; перед merge: lint+typecheck+test.

## Критические правила

1. **Доступ к контенту — только сервером** через `lib/access.ts`.
2. **Видео-раздача**: запрос сегмента → app проверяет сессию+доступ+подпись (HMAC userId+path+exp ≤4 ч) → ответ `X-Accel-Redirect: /protected-media/<key>` → nginx отдаёт файл из volume (location internal). AES-ключ (`/api/video/key/<lessonId>`) — отдельная проверка доступа, no-store. Каталог media/ снаружи nginx НЕ виден; прямых путей нет нигде, включая логи.
3. **Пароли**: argon2id; временный пароль показывается админу один раз (и опц. письмом), `mustChangePassword=true` форсирует смену; rate-limit логина (nginx-зона + таблица попыток); сессии-cookie HttpOnly+Secure.
4. **AI-ответы только из RAG-контекста доступных ученику курсов**; запрет пересказа транскрипта >2 предложений подряд; лимиты AiUsageDay до вызова API.
5. **AI-контент публикуется без человека, но никогда без критика** (`lib/ai/critic.ts`, порог 80): VALIDATED → публикация; FAILED → авто-регенерация ≤2, затем в дайджест. Это касается и переведённых субтитров (выборочная критика сегментов). Человеческой модерации НЕ СУЩЕСТВУЕТ.
6. **Фидбек-петля**: thumbsDown ≥2 → Job регенерации.
7. **Секреты** из env (`src/env.ts`, zod). `.env` не в git; на VPS — через docker secrets/env-file с правами 600.
8. **Идемпотентность** фоновых задач и (будущих) платёжных webhook (WebhookEvent unique).
9. **Минимизация ПДн на временном зарубежном VPS**: обязательное поле только e-mail/логин и имя для сертификата; телефон/прочее — опционально и не собираем без нужды; бэкапы шифруются; план переезда в РК — приоритетный (docs/MIGRATION.md). ПДн не логировать.
10. **Бюджеты ресурсов VPS — это требования**: 720p ≈ ~1 ГБ/час (контроль диска: фабрика печатает прогноз, daily-cron шлёт в дайджест занятость диска/БД при >80%); LLM-лимиты на ученика; своп и limits в compose настроены.

## Тестирование (обязательные e2e)

Вход по выданному паролю + форс-смена; недоступность урока без enrollment (включая прямые запросы playlist/key/сегмента); создание ученика админом и выдача доступа; тест с порогом/пересдачей; сертификат + /verify; переключение субтитров (дорожки подгружаются только с доступом); AI-критик режет плохой вопрос (фикстура). Unit: access.ts, storage-драйвер, подсчёт баллов, RAG, лимиты, Job-runner (ретраи, идемпотентность).

## Env

`DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `EMBEDDINGS_API_KEY`, `MEDIA_ROOT` (volume), `STORAGE_DRIVER=fs|s3` (+S3-ключи для будущего), `VIDEO_SIGNING_SECRET`, `VIDEO_KEY_ENC_SECRET` (шифрование AES-ключей HLS в БД), `EMAIL_ENABLED`, `SMTP_*`, `OWNER_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP|TELEGRAM|PHONE` (контакты на лендинге и «забыли пароль»). Будущие: `PAYMENT_PROVIDER`, `KASPI_*`. Образец — `.env.example` (поддерживать актуальным).
