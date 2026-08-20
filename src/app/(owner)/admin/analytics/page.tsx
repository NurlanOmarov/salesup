import type { Metadata } from "next";
import { BarChart3, ExternalLink } from "lucide-react";
import { getDashboard, getSiteBreakdown } from "@/lib/analytics/dashboard";
import { resolveRange } from "@/lib/analytics/range";
import { resolveSite } from "@/lib/analytics/site-filter";
import { fmtInt, fmtPct } from "@/lib/analytics/format";
import { Panel } from "@/components/admin/analytics/panel";
import { StatCard } from "@/components/admin/analytics/stat-card";
import { TrafficChart } from "@/components/admin/analytics/traffic-chart";
import { CoursePopularityTable } from "@/components/admin/analytics/course-popularity";
import { CountryList } from "@/components/admin/analytics/country-list";
import { BarList, SourceLabel } from "@/components/admin/analytics/bar-list";
import { Funnel } from "@/components/admin/analytics/funnel";
import { PeriodControls } from "@/components/admin/analytics/period-controls";
import { SiteSwitch } from "@/components/admin/analytics/site-switch";
import { SiteBreakdown } from "@/components/admin/analytics/site-breakdown";
import { ExportMenu } from "@/components/admin/analytics/export-menu";

export const metadata: Metadata = {
  title: "Аналитика",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Внешние счётчики (маркетинговый слой, D-002) — прямые ссылки на кабинеты этого
 * проекта. Своя аналитика показывает трафик/курсы/страны; источники и рекламные
 * кампании смотрим здесь. При смене счётчиков — обновить id/URL.
 */
const EXTERNAL_ANALYTICS = [
  {
    label: "Яндекс.Метрика",
    href: "https://metrika.yandex.ru/overview?id=110998512&period=week&group=day&isMinSamplingEnabled=false&attr=%7B%22attributionId%22%3A%22LastSign%22%2C%22isCrossDevice%22%3Atrue%7D&isUndefinedEnabled=false&currency=USD",
  },
  {
    label: "Google Analytics",
    href: "https://analytics.google.com/analytics/web/#/a402217951p547019038/reports/intelligenthome",
  },
] as const;

type SP = Record<string, string | string[] | undefined>;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const getParam = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : null;
  };
  const { from, to, range, compare } = await resolveRange(getParam);
  const { site } = resolveSite(getParam);
  const d = await getDashboard(from, to, compare, site);
  const breakdown = site === null ? await getSiteBreakdown(from, to) : null;

  const exportParams = new URLSearchParams({
    range,
    compare: compare ? "1" : "0",
    ...(range === "custom" ? { from: d.range.from, to: d.range.to } : {}),
    ...(site !== null ? { site } : {}),
  }).toString();

  return (
    <main className="space-y-6">
      {/* Шапка */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="size-6 text-brand" />
            Аналитика
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Свои данные о трафике, популярности курсов и воронке. Источник истины — таблица Event.
          </p>
        </div>
        <ExportMenu params={exportParams} />
      </div>

      {/* Управление доменом и периодом */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SiteSwitch active={site} />
          <PeriodControls activeRange={range} from={d.range.from} to={d.range.to} compare={compare} />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-foreground/40 sm:inline">Источники и кампании:</span>
          {EXTERNAL_ANALYTICS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {s.label}
              <ExternalLink className="size-3.5 opacity-60" />
            </a>
          ))}
        </div>
      </div>

      {/* Сводка по доменам — только в режиме «Все домены» */}
      {breakdown ? (
        <Panel title="По доменам" subtitle="Клик по строке переключает дашборд на этот домен">
          <SiteBreakdown rows={breakdown} />
        </Panel>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Посетители" value={fmtInt(d.kpis.visitors.value)} metric={d.kpis.visitors} spark={d.sparks.visitors} accent="#f4003a" compare={compare} />
        <StatCard label="Просмотры" value={fmtInt(d.kpis.views.value)} metric={d.kpis.views} spark={d.sparks.views} accent="#f59e0b" compare={compare} />
        <StatCard label="Заявки" value={fmtInt(d.kpis.leads.value)} metric={d.kpis.leads} spark={d.sparks.leads} accent="#10b981" compare={compare} />
        <StatCard label="Записи" value={fmtInt(d.kpis.enrollments.value)} metric={d.kpis.enrollments} spark={d.sparks.enrollments} accent="#8b5cf6" compare={compare} />
        <StatCard label="Конверсия" value={fmtPct(d.kpis.conversion.value)} metric={d.kpis.conversion} spark={d.sparks.conversion} accent="#0ea5e9" compare={compare} />
      </div>

      {/* График трафика */}
      <Panel title="Трафик по дням" subtitle="Посетители и просмотры публичных страниц">
        <TrafficChart data={d.timeseries} compare={compare} />
      </Panel>

      {/* Курсы + страны */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Популярность курсов"
          subtitle="Воронка просмотры → заявки → записи по каждому курсу"
          className="lg:col-span-2"
        >
          <CoursePopularityTable courses={d.courses} />
        </Panel>
        <Panel title="География" subtitle="Страны посетителей по IP — не то же самое, что выбранный домен">
          <CountryList items={d.countries} />
        </Panel>
      </div>

      {/* Воронка + страницы + источники */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Воронка конверсии" subtitle="От просмотра до записи">
          <Funnel data={d.funnel} />
        </Panel>
        <Panel title="Топ страниц" subtitle="Самые посещаемые публичные страницы">
          <BarList items={d.pages} color="#f59e0b" empty="Нет просмотров за период" />
        </Panel>
        <Panel title="Источники" subtitle="Откуда переходят на сайт">
          <BarList
            items={d.sources}
            color="#10b981"
            empty="Прямые заходы или нет внешних переходов"
            renderLabel={(s) => <SourceLabel host={s.label} />}
          />
        </Panel>
      </div>
    </main>
  );
}
