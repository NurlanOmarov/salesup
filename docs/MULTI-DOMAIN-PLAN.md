# MULTI-DOMAIN-PLAN.md — два поддомена (study.activesales.by + study.activesales.kz)

> План подключения второго поддомена к тому же сервису **без отдельного VPS/деплоя**.
> Один сервер (NAT-VPS `93.127.131.216`, внутр. `192.168.122.10`), одна БД, одна медиатека.
> Требование: **каждый домен самостоятелен** (логин/сессия остаётся на своём домене),
> канонический/fallback — `study.activesales.by`. Рынок `.kz` — Казахстан (осн. по ТЗ), `.by` — Беларусь.

## 0. Итог одной строкой
Технически задача = DNS + «Add Domain» в панели + сделать **edge, auth и SEO-метаданные host-aware**
(сейчас часть из них жёстко привязана к `.by`). Второй контейнер/сервис НЕ нужен.

---

## 1. Что уже выяснено (факты из кода/сервера)

- **Ингресс NAT-VPS:** внешние 80/443 держит шлюз провайдера; веб на VPS заводится через
  панель **Website Management → «Add Domain»** (шлюз терминирует TLS Let's Encrypt и форвардит
  HTTP на внутр. IP:порт). `.by` уже так подключён → `192.168.122.10:80` (наш edge-nginx).
- **edge-nginx** (`~/infra`, compose-проект `infra`): сейчас `listen 80 default_server`, но
  **жёстко** проставляет `Host: study.activesales.by` и `X-Forwarded-Host: study.activesales.by`
  всем запросам → для второго домена это надо снять (передавать реальный `$host`).
- **Приложение host-aware по сути:** тест показал, что route-handler Auth.js берёт Host запроса
  (`.by`→`.by`, `.kz`→`.kz`). Middleware-редиректы гейтинга строятся через `request.nextUrl`
  (`src/auth.config.ts`, `authorized`) — тоже host-aware. Значит per-domain логин достижим.
- **Баг `0.0.0.0:3000`:** на `/api/auth/*` middleware Auth.js ставит ВТОРОЙ cookie
  `__Secure-authjs.callback-url=https://0.0.0.0:3000`, который перебивает правильный host-based.
  Источник — matcher middleware ловит и `/api/auth/*` (`src/middleware.ts`).
  Сейчас замаскировано жёстким `AUTH_URL=https://study.activesales.by` (пиннит всё на `.by` —
  что ломает самостоятельность `.kz`).
- **SEO вшито на один домен:** `metadataBase`, `sitemap.ts`, `robots.ts`, ссылка сертификата —
  через `NEXT_PUBLIC_SITE_URL` (build-time = `.by`). Без правок оба домена будут указывать
  canonical/OG/sitemap на `.by` → `.kz` в органике не выделится (Google склеит на `.by`).

---

## 2. Изменения (что и где)

### 2.1 DNS (действие владельца, у NS `activeby.net`)
| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | `study` (в зоне `activesales.kz`) | `93.127.131.216` | 300 |

Проверка: `dig +short study.activesales.kz` → `93.127.131.216`.

### 2.2 Панель Database Mart → Website Management → «Add Domain» (действие владельца)
- Domain Name: `study.activesales.kz`
- IP: `192.168.122.10`, Port: `80` (как для `.by`)
- Confirm → шлюз выпустит отдельный Let's Encrypt и начнёт форвардить `.kz` на наш edge.

### 2.3 edge-nginx — сделать host-aware (`~/infra/conf.d/study.conf`)
- `server_name study.activesales.by study.activesales.kz;` (или оставить `default_server`).
- Передавать **реальный** хост вместо жёсткого `.by`:
  ```nginx
  proxy_set_header Host              $host;
  proxy_set_header X-Forwarded-Host  $host;
  proxy_set_header X-Forwarded-Proto https;   # публично всегда https (TLS на шлюзе)
  ```
- Reload edge. (Файл в репо `deploy/edge/conf.d/study.conf` привести в соответствие.)

### 2.4 Auth host-aware (репозиторий, требует redeploy)
1. **Исключить `/api/auth` из middleware-matcher** (`src/middleware.ts`) — убирает второй
   cookie `0.0.0.0:3000`; на `/api/auth/*` работает только route-handler (host-based):
   ```
   matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico|mp4|webm|glb|gltf|mp3)$).*)"]
   ```
2. **Снять пиннинг `AUTH_URL`** (чтобы Auth.js брал хост запроса — самостоятельность доменов):
   - убрать `AUTH_URL` из `deploy/docker-compose.prod.yml` (app env) и из `.env`-heredoc в
     `.github/workflows/deploy.yml`.
   - `trustHost: true` уже стоит (`src/auth.config.ts`).
3. `AUTH_COOKIE_INSECURE=false` и проброс `X-Forwarded-Proto: https` — оставить (Secure-cookie).
> ⚠️ Проверить после деплоя: на `.kz` и `.by` `/api/auth/csrf` отдаёт callback-url ТОЛЬКО своего
> домена (без `0.0.0.0`); гейтинг `/app` без сессии редиректит на `<тот же домен>/login`.

### 2.5 SEO host-aware (репозиторий) — см. раздел 3
- `metadataBase` в `src/app/layout.tsx` — вычислять из заголовка `Host` (через `headers()`),
  а не из `NEXT_PUBLIC_SITE_URL`.
- Добавить `alternates.canonical` (self) и `alternates.languages` (**hreflang**) на публичных
  страницах.
- `sitemap.ts` / `robots.ts` — host-aware (свой sitemap на каждом домене).
- Приватные зоны (`/app`, `/admin`, `/change-password`) — явный `robots: { index: false }`.

---

## 3. SEO двух стран — анализ и стратегия

**Суть проблемы:** одинаковый контент на двух ccTLD = потенциальные дубли. Но у нас
индексируется только **публичная витрина** (лендинг `/`, `/courses`, `/verify`) — кабинет за
логином в индекс не идёт. Значит вопрос касается 3–5 страниц.

**ccTLD — сильный гео-сигнал:** `.kz` Google по умолчанию таргетит на Казахстан, `.by` — на
Беларусь. Язык обоих — русский. Это идеальный кейс для **hreflang** гео-таргетинга.

### Вариант A (рекомендуется) — обе ранжируются каждая в своей стране
- **self-canonical** на каждом домене (`.kz`→`.kz`, `.by`→`.by`).
- **hreflang** на публичных страницах:
  ```html
  <link rel="alternate" hreflang="ru-KZ" href="https://study.activesales.kz{path}"/>
  <link rel="alternate" hreflang="ru-BY" href="https://study.activesales.by{path}"/>
  <link rel="alternate" hreflang="x-default" href="https://study.activesales.by{path}"/>
  ```
- Отдельный `sitemap.xml` на каждом домене (host-aware).
- Итог: `.kz` растёт в РК, `.by` — в РБ, дублей нет (Google понимает регион-варианты).
- Стоимость: host-aware metadata (раздел 2.5).

### Вариант B (проще) — единый canonical `.by`
- Оба домена отдают контент, но canonical везде = `.by` (текущее поведение «из коробки»).
- `.kz` служит рабочим адресом для прямых ссылок ученикам, но в органике не конкурирует.
- Плюс: почти ничего не менять в SEO. Минус: в поиске РК продвигается `.by`, а не `.kz`
  (для казахстанского рынка как осн. по ТЗ — неоптимально).

**Рекомендация:** Вариант A (hreflang), т.к. рынки два и `.kz` — приоритетный по ТЗ. Реализация
host-aware метаданных небольшая и переиспользуется для canonical/OG/sitemap.

### Дополнительно (обязательно при любом варианте)
- Приватные зоны — `noindex` (сейчас явного нет; добавить в layout приватных сегментов).
- Google Search Console: добавить **оба** ресурса, задать (при hreflang авто-гео обычно
  достаточно). Проверить hreflang-репорт.
- Метрика/аналитика: источник истины — своя таблица `Event` (D-002); внешние счётчики — только
  на публичных страницах, по домену различать при желании.

---

## 4. Порядок внедрения
1. DNS `.kz` → IP (владелец) + «Add Domain» в панели (владелец).
2. edge host-aware (`$host`) + reload — `.kz` начнёт отдавать контент (сессии пока пиннятся `.by`).
3. Репозиторий: middleware-matcher + снять `AUTH_URL` + SEO host-aware (+ hreflang, вариант A).
4. Merge в `main` → redeploy.
5. Проверки (раздел 5).
6. Синхронизировать `deploy/edge/*` и `docs/MIGRATION-RUNBOOK.md` с фактической схемой.

## 5. Проверки (после внедрения)
- [ ] `dig study.activesales.kz` → IP; в панели статус домена «Let's Encrypt / active».
- [ ] `https://study.activesales.kz/api/health` → `{"status":"ok","db":"up"}`.
- [ ] На `.kz`: `/api/auth/csrf` → callback-url только `...kz` (нет `0.0.0.0`, нет `.by`).
- [ ] На `.kz`: `/app` без сессии → редирект на `https://study.activesales.kz/login?...`.
- [ ] Реальный вход на `.kz` держит сессию на `.kz`; на `.by` — на `.by` (взаимно независимо).
- [ ] Видео/AES-ключ/субтитры играют на обоих доменах (X-Accel через свой nginx).
- [ ] `view-source` публичной страницы на `.kz`: canonical=self, hreflang ru-KZ/ru-BY/x-default.
- [ ] `https://study.activesales.kz/sitemap.xml` содержит `.kz`-URL; `/robots.txt` — свой sitemap.
- [ ] `/app`, `/admin` отдают `noindex`.

## 6. Откат
- Проблема с `.kz` → удалить домен в панели + снять DNS; `.by` не затрагивается.
- Регресс логина после снятия `AUTH_URL` → вернуть `AUTH_URL` в env (быстрый откат), затем
  доисследовать middleware-cookie.

## 7. Риски / заметки
- **Ресурсы:** второй домен не добавляет контейнеров — нагрузка та же (один app/db/worker).
- **Cookie-изоляция:** `__Host-/__Secure-` куки скоупятся по хосту → сессии естественно
  раздельны между `.by` и `.kz` (это и требуется).
- **NEXT_PUBLIC_SITE_URL в клиентском бандле:** вшивается на сборке (один домен). Для клиентских
  абсолютных ссылок это ок (используем относительные / host-aware серверные метаданные).
  Абсолютные ссылки в письмах/сертификатах остаются на канон. `.by` — приемлемо.
- **Auth.js beta:** поведение host-детекта может меняться между версиями — покрыть проверкой 5.
