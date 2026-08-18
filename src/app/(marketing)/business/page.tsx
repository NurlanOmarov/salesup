import type { Metadata } from "next";
import Image from "next/image";
import { BarChart3, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { MIN_B2B_SEATS, quoteSeats, SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";
import { AudienceSwitch } from "@/components/landing/audience-switch";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import { BusinessCta } from "./business-cta";
import { pageAlternates } from "@/lib/seo/site";

export const revalidate = 300;

/**
 * Корпоративный регистр лендинга (docs/PRICING-PLAN.md §8, B2B-PLAN §8).
 *
 * Отдельный URL, а не состояние на главной: у корпоративных запросов своя
 * (более дорогая) выдача, на страницу можно лить рекламу и давать ссылку в КП.
 * Переключатель «Себе | Команде» связывает её с главной в обе стороны.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/business");
  return {
    title: s.title,
    description: s.description,
    alternates: await pageAlternates("/business"),
    robots: { index: !s.noindex, follow: true },
    // Ссылку на эту страницу отправляют в мессенджере и почтой, поэтому картинка
    // репоста своя: дефолтная — про розничные курсы, а тут разговор с компанией.
    openGraph: {
      type: "website",
      url: "/business",
      title: s.title,
      description: s.description,
      images: [
        {
          url: "/images/landing/og-business.webp",
          width: 1200,
          height: 675,
          alt: "Руководитель смотрит отчёт по обучению команды",
        },
      ],
    },
  };
}

const STEPS = [
  {
    title: "Говорите, сколько сотрудников",
    body: "Считаем стоимость по числу мест и выставляем счёт. Оплата — за год.",
  },
  {
    title: "Мы заводим кабинет компании",
    body: "Ответственный за обучение получает доступ в течение одного рабочего дня.",
  },
  {
    title: "HR раздаёт коды сотрудникам",
    body: "Каждый вводит свой код, придумывает пароль — и сразу начинает учиться.",
  },
  {
    title: "Вы видите прогресс каждого",
    body: "Кто прошёл, кто не начинал, какие баллы за тесты. Отчёт выгружается файлом.",
  },
];

const BENEFITS = [
  {
    icon: BarChart3,
    title: "Прогресс каждого сотрудника",
    body: "Видно, кто учится, а кто нет: доля пройденных уроков, результаты тестов, активность за период, разрез по подразделениям.",
  },
  {
    icon: Sparkles,
    title: "AI-наставник и тренажёры 24/7",
    body: "Не разовый тренинг, а ежедневная практика: симулятор клиента, отработка возражений, голосовой ролплей с разбором речи. Новичок начинает в первый же день.",
  },
  {
    icon: RefreshCw,
    title: "Место переносится",
    body: "Сотрудник уволился — освободившееся место отдаёте другому. Платить второй раз не нужно.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Что такое «место»?",
    a: "Место — это доступ одного сотрудника к обучению на год. Купили 10 мест — одновременно учатся 10 человек. Если сотрудник уволился, место освобождается и передаётся другому.",
  },
  {
    q: "Можно ли обучить сотрудников из разных городов?",
    a: "Да, обучение полностью онлайн: видеоуроки, тесты и тренажёры доступны с компьютера и телефона в любое время.",
  },
  {
    q: "Что после окончания срока?",
    a: "Доступ к урокам прекращается, выданные сертификаты остаются в силе. Лицензию можно продлить на следующий год.",
  },
  {
    q: "Выдаёте ли вы документ об образовании?",
    a: "Нет. Услуги информационные: мы не реализуем образовательные программы и не выдаём документы об образовании. Сотрудник получает именной сертификат собственного образца с уникальным номером и страницей проверки подлинности.",
  },
  {
    q: "Как оплатить?",
    a: "По счёту на юридическое лицо или ИП. После оплаты подписываем акт. Все условия — в публичной оферте для организаций.",
  },
];

export default async function BusinessPage() {
  // На сборке БД недоступна — buildSafe отдаёт запасное значение вместо падения
  // пререндера (тот же приём, что в sitemap).
  // Курсы для калькулятора: цена места считается либо по всей библиотеке, либо
  // по выбранным курсам — компании часто нужен один отраслевой, и цена подписки
  // отпугнула бы её втрое большей суммой.
  const courses = await buildSafe(
    () =>
      db.course.findMany({
        where: { status: "PUBLISHED", inDevelopment: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, priceTiyn: true },
      }),
    [] as { id: string; title: string; priceTiyn: number }[],
  );
  const coursesCount = courses.length;

  // Крайние точки сетки: лучшая цена места (максимальный объём) и цена на входе.
  const bestPerSeat = quoteSeats(20, SUBSCRIPTION_YEAR_TIYN).pricePerSeatTiyn / 100;
  const entryPerSeat =
    quoteSeats(MIN_B2B_SEATS, SUBSCRIPTION_YEAR_TIYN).pricePerSeatTiyn / 100;
  const bestPerMonth = Math.round(bestPerSeat / 12);

  return (
    <main>
      {/* ── Первый экран ───────────────────────────────────────────── */}
      {/* Тёмный кадр, как hero на главной: корпоративная страница должна читаться
          продолжением бренда, а не отдельным документом. Текст живёт в левой,
          пустой части кадра; калькулятор ложится светлой карточкой справа. */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <Image
          src="/images/landing/business-hero.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="pointer-events-none select-none object-cover object-right"
        />
        {/* Слева заливка плотнее: под заголовком кадр почти чёрный, справа —
            видно команду. Без градиента белый текст спорил бы с окнами. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/25" />

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pt-16 lg:pb-16">
        <AudienceSwitch current="b2b" size="hero" onDark />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <h1 className="text-balance text-3xl font-bold leading-tight drop-shadow-lg sm:text-4xl lg:text-5xl">
              Обучение отдела продаж, которое не заканчивается в пятницу
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              Тренинг забывается за месяц. Годовой доступ к платформе учит каждого
              сотрудника — включая тех, кто придёт к вам через полгода, — и показывает,
              кто действительно занимается.
            </p>

            {/* Цена в первом экране: человек, который сканирует страницу за пять
                секунд, должен понять свой ли это ценовой сегмент, не долистывая
                до калькулятора. Цифры считает lib/pricing — расхождение с
                калькулятором и счётом невозможно. */}
            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-2xl font-bold sm:text-3xl">
                от {bestPerSeat.toLocaleString("ru-RU")} BYN
              </p>
              <p className="text-white/75">
                за сотрудника в год — это{" "}
                {bestPerMonth.toLocaleString("ru-RU")} BYN в месяц
              </p>
            </div>
            <p className="mt-1 text-sm text-white/60">
              При команде от 20 человек. Для {MIN_B2B_SEATS} сотрудников —{" "}
              {entryPerSeat.toLocaleString("ru-RU")} BYN за каждого.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                coursesCount > 0
                  ? `${coursesCount} курсов по продажам в отраслях и общим навыкам`
                  : "Курсы по продажам в отраслях и общим навыкам",
                "Кабинет компании с прогрессом по каждому сотруднику",
                "AI-тренажёры: симулятор клиента и отработка возражений",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-white/85">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Reveal>
            <BusinessCta
              subscriptionYearTiyn={SUBSCRIPTION_YEAR_TIYN}
              courses={courses}
            />
          </Reveal>
        </div>
        </div>
      </section>

      {/* ── Выгоды ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">Что получает компания</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-foreground/10 bg-background p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <b.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-foreground/65">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Как это работает ───────────────────────────────────────── */}
      <section className="border-y border-foreground/8 bg-foreground/[0.015]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Как это работает</h2>

          <Reveal>
            <div className="relative mt-6 aspect-[16/7] overflow-hidden rounded-2xl border border-foreground/10">
              <Image
                src="/images/landing/business-how.webp"
                alt="Сотрудники отдела продаж учатся каждый на своём ноутбуке в переговорной"
                fill
                sizes="(max-width: 1024px) 100vw, 1152px"
                className="object-cover"
              />
            </div>
          </Reveal>

          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.05}>
                <li className="relative rounded-2xl border border-foreground/10 bg-background p-5">
                  <span className="text-sm font-bold text-brand">0{i + 1}</span>
                  <h3 className="mt-1.5 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-foreground/65">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">Вопросы закупщика</h2>
        <div className="mt-6">
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      {/* ── Повтор заявки ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.015] p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Посчитаем под вашу команду</h2>
          <p className="mt-2 max-w-2xl text-foreground/65">
            Скажите, сколько сотрудников и какие темы нужны, — пришлём расчёт и счёт.
            Если команда меньше пяти человек, подберём обычные доступы.
          </p>
          <div className="mt-6">
            <BusinessCta
              subscriptionYearTiyn={SUBSCRIPTION_YEAR_TIYN}
              courses={courses}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
