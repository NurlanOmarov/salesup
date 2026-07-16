# SEO-аудит SalesAcademy

_Дата: 2026-07-15. Аудит по фактическому коду публичных страниц, метаданным, structured data, sitemap/robots, производительности и перелинковке._

> **Статус внедрения (обновлено 2026-07-16):** пункты 1–10 и 12 закрыты и протестированы вживую (typecheck/lint + рендер HTML на временной БД). Пункт 11 (контент-хаб / блог) отложен в бэклог как задача роста.

## ✅ Что уже сделано хорошо

- **Метаданные-фундамент**: `metadataBase`, шаблон title `%s · SalesAcademy`, дефолтные title/description в `src/app/layout.tsx`, `lang="ru"`.
- **Sitemap** динамический (статические + опубликованные курсы) с `revalidate` — `src/app/sitemap.ts`; **robots.ts** с disallow приватных зон.
- **Structured data**: `Course` + `FAQPage` на странице курса, `FAQPage` на главной, `ItemList` в каталоге.
- **OG-картинки**: авто-генерация `src/app/opengraph-image.tsx` (1200×630) и для страницы курса.
- **Canonical** на главной, каталоге и курсе; **noindex** на всех приватных страницах кабинета.
- **PWA-manifest**, семантика h1/h2, `next/image` с `sizes`/`alt`, ISR.

Основа сильная. Проблемы — точечные, но есть один критичный.

---

## 🔴 Критично

### 1. ✅ Страница проверки сертификата индексируется вместе с ПДн
`src/app/(marketing)/verify/[hash]/page.tsx` отдаёт `holderName` (ФИО ученика), `force-dynamic`, но **без `robots: noindex`**. По CLAUDE.md правило 9 (минимизация ПДн) попадание ФИО в индекс Google — прямое нарушение. `robots.ts` её не закрывает (disallow-а `/verify` нет).

**Фикс:** добавить `export const metadata = { robots: { index: false, follow: false } }`.
**Сделано:** добавлен `robots: { index: false, follow: false }`. В рендере: `<meta name="robots" content="noindex, nofollow">`.

---

## 🟡 Важно

### 2. ✅ Нет Twitter/X Card
Ни в `layout.tsx`, ни на страницах нет `twitter: { card: "summary_large_image", ... }`. При шаринге в X/Telegram превью падает на голый OG или обрезается.

**Фикс:** добавить `twitter` в корневой `metadata` (image возьмётся из opengraph-image).
**Сделано:** в `layout.tsx` добавлены `twitter` (summary_large_image) и OG `siteName`/`locale`. `twitter:image` подхватывается из `opengraph-image` автоматически.

### 3. ✅ Нет сайт-вайд Organization / EducationalOrganization schema
JSON-LD `Organization` встречается только вложенно как `provider` курса. Нет корневого объекта с `logo`, `sameAs` (соцсети), `contactPoint`, адресом (Астана/Алматы). База для Knowledge Panel и брендовой выдачи.

**Фикс:** вынести `EducationalOrganization` JSON-LD в `layout.tsx`.
**Сделано:** в `layout.tsx` добавлен `EducationalOrganization` (name, url, logo, description, areaServed=KZ, contactPoint с телефоном поддержки). `sameAs` (соцсети) — добавить, когда появятся ссылки на профили.

### 4. ✅ Course JSON-LD не использует отзывы → нет звёзд в выдаче
На странице курса есть `reviews` (VALIDATED), но в `courseJsonLd` нет `aggregateRating` и `review[]`. Самый заметный rich-result (звёзды в SERP), доступен бесплатно из имеющихся данных.

**Фикс:** добавить `aggregateRating` (среднее + count) и массив `review`.
**Сделано:** добавлен `db.review.aggregate` (avg + count по VALIDATED) → `aggregateRating`, плюс массив `review[]`. Проверено на `sales-pharma`: `ratingValue 5, reviewCount 5`, 5 объектов Review в JSON-LD.

### 5. ✅ Нет BreadcrumbList
Ни каталог, ни страница курса не отдают разметку хлебных крошек (Главная › Курсы › Название).

**Фикс:** добавить `BreadcrumbList` JSON-LD на `courses/[slug]` и `courses`.
**Сделано:** `BreadcrumbList` добавлен на страницу курса (Главная › Курсы › Название) и в каталог (Главная › Курсы). Проверено в рендере.

### 6. ✅ Слабая внутренняя перелинковка
Футер `src/components/landing/site-footer.tsx` линкует только `/offer` и `/privacy`. Нет ссылок на каталог, главную, отдельные курсы. Хедер даёт только `/courses` и `/login`. Для распределения ссылочного веса на страницы курсов этого мало.

**Фикс:** в футер добавить блок «Курсы» со ссылками на каталог и топ-курсы.
**Сделано:** в футер добавлен блок «Навигация» (Главная / Каталог курсов / Вход для учеников). Ссылки на отдельные топ-курсы можно добавить позже, когда определится приоритет.

### 7. ✅ Тонкий контент на /offer и /privacy
Обе страницы — заглушки «Текст будет добавлен» (`offer/page.tsx`, `privacy/page.tsx`), но открыты к индексации и в sitemap. Google трактует как thin/soft-404.

**Фикс:** наполнить перед запуском (BACKLOG S6.4) либо временно `noindex`.
**Сделано:** проставлен временный `robots: { index: false, follow: true }` на обеих страницах. ⚠️ Снять `noindex` при наполнении текстом (BACKLOG S6.4).

---

## 🟢 Желательно / рост

### 8. ✅ LCP главной завязан на анимированный h1
`src/components/landing/animated-title.tsx` — client-компонент на framer-motion, слова появляются с `delay 0.15 + i*0.07`. LCP-элемент первого экрана рисуется с задержкой через JS-гидрацию. `prefers-reduced-motion` спасает не всех.

**Фикс:** рендерить заголовок первого экрана без задержки opacity (анимировать только transform), чтобы текст был в DOM сразу.
**Сделано:** `AnimatedTitle` переписан в серверный компонент на чистом CSS (`.hero-word` в globals.css) — только `transform` (translateY), без задержки opacity; текст в SSR-HTML сразу. framer из компонента убран, H1 вынесен из-под `Reveal`. Проверено: 8 spans `hero-word` в рендере.

### 9. ✅ Много client-обёрток `Reveal` на первом экране
Почти каждая секция обёрнута в `Reveal` (framer-motion) → рост JS-бандла и hydration-cost на мобайле (рынок КЗ — мобильный).

**Фикс:** для критичных секций заменить на CSS-анимацию по `IntersectionObserver` без framer.
**Сделано:** `Reveal` переписан на `IntersectionObserver` + CSS-transition (API прежний) — `motion.div` заменён на обычный `div`, снижена стоимость гидратации на всех страницах лендинга/каталога. ⚠️ framer-motion остаётся в бандле лендинга из-за `ai-demo`/`faq`/`stat-counter`/`industries-marquee`/`lead-form` — полное удаление из бандла возможно отдельным заходом (конвертировать и их).

### 10. ✅ H1 главной без ключевого гео/интента
H1 = «Техники продаж, которые работают в вашей отрасли». Ключи «курсы/тренинги по продажам · Астана · Алматы» живут только в бейдже (не заголовок).

**Фикс:** добавить гео / «курсы по продажам» ближе к H1 и первому абзацу.
**Сделано:** H1 изменён на «**Курсы по продажам**, которые работают в вашей отрасли» (`src/content/landing.ts`) — основной ключ теперь в заголовке. Гео («Астана · Алматы») остаётся в бейдже над H1.

### 11. ⏳ Отсутствует контент-хаб (блог) — отложено (бэклог)
Под запросы «курсы по продажам Астана», «как отрабатывать возражения» нет посадочных статей. Главный резерв органики. Скилы: `seo-aeo-content-cluster`, `programmatic-seo` (страницы «продажи в <отрасли>» — `industries` уже есть).

**Решение (2026-07-16):** пока не делаем — оставлено в бэклоге как задача роста. Рекомендуемый вариант при возврате: файловый блог на MDX (без БД/админки, в духе «один сервер», контент генерируется в Claude Code) — роуты `/blog`, `/blog/[slug]`, `Article`+`BreadcrumbList` JSON-LD, включение в sitemap только при наличии статей (иначе thin content).

### 12. Мелочи
- ✅ Дубль объявления иконки: `icons.icon: "/icon.svg"` в `layout.tsx` при наличии авто-`app/icon.svg` — **убран**.
- ⏳ Проверить, что `NEXT_PUBLIC_SITE_URL` = `https://study.activesales.by` (от него зависят canonical/OG/sitemap). _Проверить в проде-`.env`._
- hreflang пока не нужен (сайт RU, языки — на уровне субтитров видео, не страниц). Отмечено на будущее.

---

## Приоритетный план внедрения

1. ✅ 🔴 `noindex` на `/verify/[hash]` — закрывает утечку ПДн.
2. ✅ 🟡 Twitter Card + `EducationalOrganization` в layout.
3. ✅ 🟡 `aggregateRating` + `review` и `BreadcrumbList` на странице курса (звёзды в выдаче).
4. ✅ 🟡 Перелинковка в футере + временный `noindex` на offer/privacy.
5. ✅ 🟢 Оптимизация LCP/бандла (пункты 8–10): CSS-заголовок, лёгкий `Reveal`, ключ в H1.
6. ⏳ 🟢 Контент-хаб / блог (пункт 11) — отложен в бэклог.

---

## Гигиена после внедрения (не забыть)

- Снять временный `noindex` с `/offer` и `/privacy` после наполнения текстом (BACKLOG S6.4).
- Добавить `sameAs` (ссылки на соцсети) в `EducationalOrganization`, когда появятся профили.
- После деплоя прогнать страницы через Google Rich Results Test (Course / FAQ / Breadcrumb) и отправить sitemap в Search Console.
- (Опц.) Полностью убрать framer-motion из бандла лендинга: конвертировать `ai-demo`, `faq`, `stat-counter`, `industries-marquee`, `lead-form` на CSS — тогда `framer` перестанет грузиться на публичных страницах.
- Замерить LCP/INP до и после (PageSpeed Insights) на мобильном, чтобы подтвердить эффект правок 8–10.

