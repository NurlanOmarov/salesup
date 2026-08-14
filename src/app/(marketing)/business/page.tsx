import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { buildSafe } from "@/lib/utils";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { SUBSCRIPTION_YEAR_TIYN } from "@/lib/pricing";
import { AudienceSwitch } from "@/components/landing/audience-switch";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import { BusinessCta } from "./business-cta";

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
    alternates: { canonical: "/business" },
    robots: { index: !s.noindex, follow: true },
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
    icon: ShieldCheck,
    title: "Мы не получаем данные ваших сотрудников",
    body: "Работники учатся под условными обозначениями вида «acme-0042». Фамилии, почты и телефоны сотрудников на платформе не хранятся — соответствие ведёте вы у себя.",
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
    q: "Нужно ли передавать вам данные сотрудников?",
    a: "Нет. Вы получаете коды доступа и раздаёте их сами. Сотрудник регистрируется по коду, а платформа присваивает ему условное обозначение. Мы не запрашиваем ни фамилий, ни почт, ни телефонов — оператором персональных данных остаётесь вы. Условия зафиксированы в оферте для организаций и приложении к ней.",
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
  const coursesCount = await buildSafe(
    () => db.course.count({ where: { status: "PUBLISHED" } }),
    0,
  );

  return (
    <main>
      {/* ── Первый экран ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
        <AudienceSwitch current="b2b" size="hero" />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Обучение отдела продаж,
              <br />
              которое не заканчивается в пятницу
            </h1>
            <p className="mt-5 max-w-xl text-lg text-foreground/70">
              Тренинг забывается за месяц. Годовой доступ к платформе учит каждого
              сотрудника — включая тех, кто придёт к вам через полгода, — и показывает,
              кто действительно занимается.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                coursesCount > 0
                  ? `${coursesCount} курсов по продажам в отраслях и общим навыкам`
                  : "Курсы по продажам в отраслях и общим навыкам",
                "Кабинет компании с прогрессом по каждому сотруднику",
                "AI-тренажёры: симулятор клиента и отработка возражений",
                "Персональные данные сотрудников остаются у вас",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-foreground/80">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Reveal>
            <BusinessCta subscriptionYearTiyn={SUBSCRIPTION_YEAR_TIYN} />
          </Reveal>
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

      {/* ── Приватность ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-8 rounded-2xl border border-foreground/10 bg-background p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
              <KeyRound className="size-5" />
            </div>
            <h2 className="mt-4 text-2xl font-bold">
              Согласовывать нечего: данных сотрудников у нас нет
            </h2>
            <p className="mt-3 text-foreground/70">
              Обычно корпоративное обучение начинается с выгрузки списка сотрудников
              поставщику — и с долгого согласования со службой безопасности. У нас
              этого шага нет вовсе.
            </p>
            <p className="mt-3 text-foreground/70">
              Оператором персональных данных работников остаётесь вы; платформа
              обрабатывает только условные обозначения и сведения о ходе обучения —
              это зафиксировано в{" "}
              <Link href="/offer-b2b" className="underline hover:text-brand">
                оферте для организаций
              </Link>{" "}
              и приложении о поручении на обработку.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-600/20 bg-emerald-500/[0.05] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Что видим мы
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground/75">
                <li>код сотрудника: acme-0042</li>
                <li>подразделение, если указали</li>
                <li>прогресс, баллы, сертификаты</li>
              </ul>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Чего не видим
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground/60">
                <li>фамилий и имён</li>
                <li>почт и телефонов</li>
                <li>кто скрывается за кодом</li>
              </ul>
            </div>
          </div>
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
            <BusinessCta subscriptionYearTiyn={SUBSCRIPTION_YEAR_TIYN} />
          </div>
        </div>
      </section>
    </main>
  );
}
