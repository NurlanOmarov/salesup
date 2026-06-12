# BACKLOG — SalesAcademy v1.2 «Автопилот / Один сервер»

План задач для Claude Code. Каждая задача — готовый промпт (вместе с `CLAUDE.md` и `docs/TZ.md`).

**Ключевые отличия v1.2 от v1.1:**
1. **Один VPS, без сторонних сервисов** (кроме LLM API): Docker Compose (app + PostgreSQL/pgvector + nginx + worker). Сейчас — DatabaseMart (временно), целевой — ps.kz/hoster.kz; миграция = pg_dump + rsync media + compose up. Хранилище медиа — абстракция `lib/storage` (драйвер `fs`, готовность к `s3`).
2. **Онлайн-оплаты в MVP нет**: админ создаёт ученика, выдаёт логин/временный пароль и доступы вручную после устного подтверждения оплаты. Платёжный модуль (Kaspi/Freedom Pay) — Фаза 2; модели в схеме уже готовы.
3. **Видео на диске VPS** (вариант Б): HLS AES-128 кодируется локально фабрикой, заливается rsync-ом, раздаётся nginx-ом через X-Accel-Redirect после серверной проверки доступа.
4. **Субтитры RU/KK/EN/UZ**: фабрика переводит очищенный транскрипт LLM-ом, кладёт VTT-дорожки рядом с видео, плеер даёт переключатель.
5. Cloudflare/Vercel/Supabase/Resend/Inngest/Bunny — исключены полностью.

**Правила:** порядок = очередность; одна задача = одна ветка = один диалог; закрытие — по AC + зелёные `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. 🟥 критический путь · 🟨 важно · 🟩 можно отложить.

---

## ФАЗА 0 — Подготовка

**P0.1 🟥 Сервер и окружение (вручную).** Арендовать VPS (DatabaseMart, Linux, ≥2 vCPU/4 ГБ RAM/диск ≥80 ГБ с запасом под видео: 720p ≈ 1 ГБ/час). Домен .kz → A-запись. На сервере: Docker + compose, пользователь deploy, SSH-ключи, ufw (22/80/443), fail2ban. Локально: Node 22, pnpm, ffmpeg, yt-dlp. Ключи: Anthropic API; embeddings free tier (Voyage/Gemini). Зафиксировать в DECISIONS.md: DatabaseMart — временно; требование закона РК о локализации ПДн → минимизация собираемых данных + приоритетный переезд на ps.kz/hoster.kz (runbook появится в S6.5).

**P0.2 🟥 Инициализация репозитория и деплой-каркас.**
> Создай Next.js 15 (App Router, TS strict, Tailwind 4, pnpm, output: standalone), shadcn/ui, Prisma, Vitest, Playwright, pino-логирование. Структура из CLAUDE.md, `src/env.ts` (zod). Каталог `deploy/`: Dockerfile (multi-stage), docker-compose.yml (app, postgres:16+pgvector, nginx, worker; volumes: pgdata, media; resource limits), nginx.conf (TLS-заготовка под certbot, proxy на app, `location /protected-media/ { internal; alias /media/; }`, rate-limit зоны для /api/auth и /api/ai), `scripts/deploy.sh` (build → rsync → ssh compose up -d --build). GitHub Actions: lint+typecheck+test. `lib/storage`: интерфейс (get/putStream/exists/delete/publicUrl?) + драйвер fs (MEDIA_ROOT) + заглушка s3 с TODO; unit-тесты fs-драйвера.

AC: `docker compose up` локально поднимает весь стек; деплой-скрипт выкатывает на VPS; https работает; CI зелёный.

**P0.3 🟥 Схема БД и сиды.**
> schema.prisma v1.2 из docs → первая миграция + raw-SQL ivfflat-индекс на embedding. `prisma/seed.ts`: владелец (OWNER, argon2id-пароль из env сида), тестовый ученик (mustChangePassword=true), курс-каркас «Техники продаж в туризме» (2 модуля, 4 урока с youtubeUrl, 1 isFreePreview), бейджи. Контент создаст фабрика. `lib/db.ts`.

---

## ФАЗА 1 — MVP «автопилот учит, админ выдаёт доступы» (спринты 1–6)

### Спринт 1 — Auth и публичные страницы

**S1.1 🟥 Аутентификация: логин/пароль, учётки от админа.**
> Auth.js v5 Credentials: вход e-mail+пароль (argon2id, verify в `lib/auth/password.ts`), сессии JWT HttpOnly. Защита от перебора: таблица LoginAttempt (5 неудач/15 мин на e-mail и на IP) + nginx rate-limit. При mustChangePassword — принудительный экран смены пароля до любого другого действия (middleware). /login на русском, аккуратный, Framer Motion. Хелперы requireUser()/requireOwner(). Страницы регистрации НЕТ — учётки создаёт только админ (S5.1). «Забыли пароль?» → текст «обратитесь к администратору» с контактами (WhatsApp/Telegram-ссылка из env) — без e-mail-flow в MVP.

AC: e2e: вход выданным паролем → форс-смена → кабинет; 6-я попытка подряд блокируется; self-signup невозможен.

**S1.2 🟥 Лендинг (SSG).**
> По ТЗ §4.1.1: Hero, «Как проходит обучение», отрасли, методика («живые тренинги + AI-наставник 24/7»), отзывы-карусель (VALIDATED), счётчики, FAQ, футер с реквизитами/офертой. CTA покупки ведёт на форму заявки/контакты (WhatsApp/Telegram/телефон + форма «оставьте контакты» → запись Lead в БД и пометка в дайджест) — БЕЗ онлайн-оплаты. Контент в content/landing.ts, whileInView, prefers-reduced-motion.

AC: Lighthouse Perf/SEO ≥ 90 mobile; заявка с формы появляется в админке.

**S1.3 🟥 Каталог и страница курса (ISR).**
> /courses и /courses/[slug] как в ТЗ: программа, learnPoints, бесплатные демо-уроки, отзывы, FAQ, JSON-LD (Course, Offer, FAQPage). Кнопка «Записаться» → блок «Как купить»: цена + контакты + форма заявки (Lead с привязкой к курсу). generateMetadata, sitemap.ts, robots.ts, OG-изображения (satori), favicon, cookie-consent. Аналитика — по D-002 (docs/DECISIONS.md): серверный лог в таблицу Event — источник истины; Метрика/GA4 только на публичных страницах, подключение на S6.4 за cookie-consent.

AC: Rich Results валиден; DRAFT → 404; заявки с привязкой к курсу видны админу.

### Спринт 2 — Видео: конвейер, защита, субтитры

**S2.1 🟥 CLI: видео-конвейер YouTube → HLS AES → VPS.**
> `scripts/factory/video.ts`: yt-dlp скачивает исходник → FFmpeg: HLS 720p (~2.5 Mbps) + 480p, сегменты 6 с, AES-128 (`hls_key_info_file`); ключ per-lesson хранится в БД зашифрованным app-секретом; URI ключа в плейлисте → `/api/video/key/<lessonId>`; → выгрузка через lib/storage (fs поверх SSH/rsync: артефакты собираются локально в out/, затем `rsync -a` в MEDIA_ROOT VPS) → Lesson.videoKey, videoStatus=READY, durationSec. Команды `factory:video <url> --lesson <id>` и батч `--course`. Идемпотентно; отчёт: размер, прогноз занятости диска VPS.

AC: реальный урок прогоняется одной командой; на VPS нет нешифрованных mp4; повторный запуск перезаписывает без дублей.

**S2.2 🟥 Защищённая раздача (X-Accel-Redirect) и плеер.**
> `GET /api/video/playlist/<lessonId>` → requireUser → canAccessLesson → m3u8 с переписанными URI сегментов на `/api/video/media/<подписанный путь>` (HMAC userId+path+exp ≤ 4 ч). `GET /api/video/media/...` → проверка подписи и сессии → заголовок `X-Accel-Redirect: /protected-media/<key>` (nginx internal отдаёт файл). `GET /api/video/key/<lessonId>` → проверка доступа → 16 байт ключа, no-store. SecurePlayer: hls.js (Safari — нативно), скорость 0.5–2x, качество, динамический водяной знак (e-mail, случайная позиция каждые 20–40 с), блокировка contextmenu. Прогресс: upsert LessonProgress каждые 10 с/на pause, старт с lastPositionSec, completedAt при ≥90%.

AC: e2e: без enrollment playlist/key/сегмент → 403; с доступом видео играет; подписанный URL после exp → 403; «продолжить с места» работает.

**S2.3 🟥 Субтитры RU/KK/EN/UZ.**
> Фабрика `factory:subs`: из cleanText с таймкодами → VTT (RU origin=ORIGINAL); переводы KK/EN/UZ — Claude Haiku батчами с сохранением таймкодов и терминологии продаж (глоссарий в промпте), выборочная валидация критиком (10% сегментов: смысл сохранён, таймкоды не сломаны) → SubtitleTrack(VALIDATED) + vttKey. Раздача VTT — тем же защищённым каналом, что сегменты. В SecurePlayer — переключатель дорожек (выкл/RU/KK/EN/UZ, native text tracks), запоминание выбора в профиле.

AC: на демо-уроке переключаются 4 языка; таймкоды совпадают с речью; VTT недоступен без enrollment; стоимость перевода часа видео залогирована.

**S2.4 🟥 lib/access.ts + тесты.** Единый модуль (enrollment активен/expiresAt/revokedAt, isFreePreview, PublishStatus, OWNER, requiresQuizPass). Полное unit-покрытие; все проверки в проекте — только через него.

### Спринт 3 — Фабрика контента + AI-критик

**S3.1 🟥 CLI: транскрипты.** Субтитры YouTube (youtubei.js; fallback faster-whisper локально) → rawText → очистка Haiku (пунктуация, термины, без паразитов, [mm:ss] на абзац) → cleanText → чанки 300–800 ток. overlap 80 → embeddings (free tier, батчами) → TranscriptChunk (raw-SQL vector). `lib/ai/rag.ts: searchChunks()`. Интеграционный тест: «возражение дорого» находит нужные чанки.

**S3.2 🟥 AI-критик (`lib/ai/critic.ts`).** Универсальный валидатор: объект + чанки → Haiku → JSON {score, pass, issues[]}; чек-листы per-тип (вопрос: ответ есть в уроке, один однозначный правильный, дистракторы правдоподобны; конспект: без выдумок; субтитры: смысл/таймкоды). `generateWithCritic(maxRegens=2)`. Snapshot-тесты: плохой вопрос → FAILED, хороший → VALIDATED.

**S3.3 🟥 CLI: генерация учебного контента.** По уроку через generateWithCritic: LESSON_QUIZ 8–12 вопросов (все типы + 1–2 OPEN_TEXT с rubric, explanation с таймкодом), AiArtifact SUMMARY/CHECKLIST/FLASHCARDS, SimulationScenario. По курсу: FINAL_EXAM 20 вопросов. Sonnet-генератор, Haiku-критик; только VALIDATED публикуется.

AC: фабрика закрывает демо-курс контентом; ручная сверка 20 вопросов не находит вопроса без ответа в материале; стоимость залогирована.

**S3.4 🟥 CLI: курс под ключ.** `factory:ingest <playlistUrl> --course <slug> [--price]`: плейлист → Course/Module/Lesson (названия и разбивка — LLM) → видео (S2.1) → субтитры (S2.3) → транскрипты (S3.1) → контент (S3.3) → маркетинг курса (description, learnPoints, FAQ, SEO — через критика) → отчёт (создано/FAILED/диск/стоимость). Курс остаётся DRAFT; публикация — кнопка владельца.

AC: реальный плейлист «Техники продаж в туризме» → полный DRAFT-курс одной командой; идемпотентность.

### Спринт 4 — Обучение: тесты и кабинет ученика

**S4.1 🟥 Прохождение теста.** По одному вопросу на экран, все типы (dnd для ORDERING, инпуты FILL_BLANK), мгновенная проверка с анимацией (canvas-confetti), explanation. Attempt server-side; правильные ответы не попадают в клиент до сдачи; scorePct, PASSED/FAILED, разбор, пересдачи (maxAttempts). OPEN_TEXT: Haiku по rubric+чанкам → JSON {pointsAwarded, perCriterion, feedback} (zod, retry 1; фоллбэк Sonnet; при двойном сбое вопрос исключается из подсчёта пропорционально). requiresQuizPass учитывается access-модулем.

**S4.2 🟥 Кабинет ученика.** /app: «Продолжить обучение», карточки с анимированным прогрессом. /app/learn/...: сайдбар-оглавление (чекмарки/замки), SecurePlayer с переключателем субтитров, табы «Транскрипт | Конспект | Заметки», «Проверь себя», prev/next. Транскрипт: подсветка по currentTime, клик→seek, поиск, user-select:none, виртуализированная подгрузка. Конспект (VALIDATED) + «Скачать PDF» (персонализированный футер ФИО/e-mail, Job, кэш per-user). Заметки с таймкодами. 👎/👍 на вопросах и конспекте → thumbsDown, Job регенерации при ≥2.

AC: полный путь удобен на 375px; дизлайк ×2 ставит Job (unit).

**S4.3 🟩 Профиль и onboarding.** /app/settings: имя «как в сертификате», отрасль, должность, язык субтитров по умолчанию, смена пароля. 3-шаговый пропускаемый onboarding.

### Спринт 5 — Админ: ручная выдача доступов, сертификаты

**S5.1 🟥 Управление учениками и доступами (ядро MVP-продаж).**
> /admin/students: список+поиск; «Создать ученика»: e-mail (логин), имя, телефон (опц.), отрасль → генерация временного пароля (показывается ОДИН раз с кнопкой копирования; опц. отправка письмом при EMAIL_ENABLED) → сразу же чекбоксы курсов для выдачи Enrollment (source=MANUAL, срок из accessDuration или вручную). Карточка ученика: доступы (выдать/отозвать/продлить), сброс пароля (новый временный + mustChangePassword), прогресс и попытки, заморозка. Журнал действий админа (AdminLog: кто/что/когда) — каждая выдача доступа фиксируется. /admin/leads: заявки с лендинга, статус (новая/связались/оплачено→кнопка «создать ученика» с префиллом), комментарий.

AC: e2e: админ создаёт ученика+доступ ≤ 1 мин → ученик входит, меняет пароль, смотрит курс; отзыв доступа закрывает видео немедленно; все действия в AdminLog.

**S5.2 🟥 Консоль владельца (остальное).** /admin: дашборд (ученики, активность, completion, AI-расходы, диск/БД). /admin/courses: цена, публикация, команда-подсказка фабрики. /admin/flags: подозрительная активность, FAILED-контент, ContentGap-топ, дизлайки. Никаких очередей модерации.

**S5.3 🟥 Сертификаты.** Job certificate.generate при выполнении условий (все уроки + FINAL_EXAM ≥ minScore): PDF (бланк из storage, ФИО, курс, hoursLabel, номер, QR → /verify/[hash]) → storage → Certificate (+письмо при EMAIL_ENABLED). /app/certificates + публичная /verify/[hash].

**S5.4 🟨 Worker и cron.** Контейнер worker: цикл Job (SKIP LOCKED, ретраи, backoff) + node-cron: daily (антишаринг-эвристики, стрик-заглушка, контроль диска/БД >80% → дайджест), weekly (дайджест). Unit: идемпотентность и ретраи.

**S5.5 🟨 E-mail (опционально, EMAIL_ENABLED).** nodemailer+SMTP, шаблоны react-email: «Ваш доступ» (логин+временный пароль), «Сертификат», дайджест владельцу. SPF/DKIM/DMARC-инструкция в docs/; честное предупреждение о доставляемости self-hosted SMTP. При выключенном флаге всё работает без писем (дайджест — страница /admin/digest).

### Спринт 6 — Антишаринг, дайджест, запуск, миграция-готовность

**S6.1 🟨 Антишаринг.** Device upsert при логине (fingerprint, IP); лимит 2 активных устройства → выбивание старой сессии; daily-эвристики (города >2/24 ч, watchedSec > 3× длительности) → /admin/flags; заморозка.

**S6.2 🟥 Еженедельный дайджест.** Письмо/страница: новые ученики и выданные доступы, активность, completion, топ ContentGap, FAILED-контент, дизлайки/регенерации, LLM-расход в ₸, диск/БД/бэкапы. Принцип: владелец заходит в админку по событию.

**S6.3 🟥 Бэкапы и эксплуатация.** Ночной cron на VPS: pg_dump (gzip, шифрование age/gpg) + tar манифест media → копия на машину владельца (pull по SSH) и/или второй диск; скрипт restore + ПРОВЕРЕННОЕ восстановление на чистом контейнере (обязательный прогон!). healthcheck-эндпоинт + uptime-проверка (cron curl с машины владельца). Логи: pino → файл с ротацией.

**S6.4 🟥 Предзапуск-чеклист.** Lighthouse ≥ 90; e2e зелёные; rate-limit auth/ai; security-заголовки (CSP), TLS A-рейтинг; оферта/политика (с учётом ПДн!); 404/500; фабрика прогнана на 1 реальном курсе; «боевая» выдача доступа реальному ученику; бета 10–20 человек.

**S6.5 🟥 docs/MIGRATION.md (Б → А, DatabaseMart → ps.kz).** Пошаговый runbook: заказ VPS ps.kz/hoster.kz → compose up → pg_dump/restore → rsync media → смена DNS (TTL заранее ↓) → проверка чек-листом; вариант с переходом на S3 ps.kz: реализация драйвера s3 в lib/storage (готовый интерфейс), фоновая синхронизация media → S3, переключение STORAGE_DRIVER. Оценка простоя ≤ 30 мин.

**🏁 Milestone MVP:** курс собирается одной командой фабрики → владелец публикует и после устной оплаты выдаёт логин/пароль за минуту → ученик смотрит шифрованное видео с водяным знаком и субтитрами на 4 языках → проходит AI-тест → получает сертификат. Всё на одном VPS, из внешнего — только LLM API.

---

## ФАЗА 2 — Интерактивный AI + онлайн-оплата

**S7.1 🟥 AI-чат-наставник** (бэкенд: стриминг, RAG урок+курс, лимиты, защита промпта, ContentGap при низкой релевантности; red-team тесты) и **S7.2 🟥 UI чата** (чипы вопросов с industry, таймкоды-пилюли→seek, остаток лимита, 👎). Как v1.1.

**S7.3 🟥 Симулятор клиента.** VALIDATED-сценарии: диалог с Sonnet-«клиентом» (≤12 реплик, шкала настроения), debrief по objectives с таймкодами, SimulationRun, XP, лимит/день.

**S7.4 🟨 Карточки и интервальное повторение.** FLASHCARDS-режим + Job-планировщик 2/7/30 дней, /app/review.

**S7.5 🟥 Онлайн-оплата (когда готов договор).** Чекаут + lib/payments (интерфейс уже в кодбейсе): MockProvider → e2e; затем Kaspi Pay или Freedom Pay (счёт/redirect, HMAC-webhook → WebhookEvent → Order PAID → авто-Enrollment(PURCHASE) → письмо), возвраты, фискальный чек. Ручная выдача остаётся параллельным каналом (корпоративные «по счёту»).

---

## ФАЗА 3 — Рост

**S8 🟨 Геймификация** (XP, уровни, стрик, бейджи, Lottie). **S9 🟨 Telegram-бот** (уведомления вместо e-mail — решает проблему self-hosted SMTP; дайджест владельцу). **S10 🟩 Авто-блог** из транскриптов через критика. **S11 🟨 Корпоративный режим** (пакеты мест, дашборд руководителя). **S12 🟩 Казахский/узбекский интерфейс** (next-intl; субтитры уже есть). **S13 🟩 Self-hosted аналитика** (Matomo/PostHog CE в compose). **S14 🟥 Переезд в Казахстан** по MIGRATION.md (приоритет — требование локализации ПДн).

---

## Сквозной Definition of Done

1. Соответствие CLAUDE.md v1.2, включая правила 2 (X-Accel-Redirect), 3 (пароли), 5–6 (критик/фидбек-петля), 9 (ПДн), 10 (бюджеты VPS).
2. Zod-валидация входов; доступы через lib/access.ts; медиа только через lib/storage (относительные ключи).
3. Тесты по AC зелёные; lint/typecheck/build чистые; мобильная вёрстка (375px); русские тексты вычитаны.
4. Новые env → src/env.ts и .env.example; миграции закоммичены; решения → DECISIONS.md.
5. Ни одна фича не создаёт обязательного ручного шага, кроме явных админ-операций выдачи доступа.
