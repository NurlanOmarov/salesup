import type { Metadata } from "next";
import { BarChart3, ExternalLink } from "lucide-react";
import { getDashboard } from "@/lib/analytics/dashboard";
import { resolveRange } from "@/lib/analytics/range";
import { fmtInt, fmtPct } from "@/lib/analytics/format";
import { Panel } from "@/components/admin/analytics/panel";
import { StatCard } from "@/components/admin/analytics/stat-card";
import { TrafficChart } from "@/components/admin/analytics/traffic-chart";
import { CoursePopularityTable } from "@/components/admin/analytics/course-popularity";
import { CountryList } from "@/components/admin/analytics/country-list";
import { BarList, SourceLabel } from "@/components/admin/analytics/bar-list";
import { Funnel } from "@/components/admin/analytics/funnel";
import { PeriodControls } from "@/components/admin/analytics/period-controls";
import { ExportMenu } from "@/components/admin/analytics/export-menu";

export const metadata: Metadata = {
  title: "Аналитика",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { from, to, range, compare } = await resolveRange((k) => {
    const v = sp[k];
    return typeof v === "string" ? v : null;
  });
  const d = await getDashboard(from, to, compare);

  const exportParams = new URLSearchParams({
    range,
    compare: compare ? "1" : "0",
    ...(range === "custom" ? { from: d.range.from, to: d.range.to } : {}),
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

      {/* Управление периодом */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodControls activeRange={range} from={d.range.from} to={d.range.to} compare={compare} />
        <a
          href="https://metrika.yandex.ru"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-foreground/40 transition-colors hover:text-foreground/70"
        >
          Источники и кампании — в Метрике/GA
          <ExternalLink className="size-3.5" />
        </a>
      </div>

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
        <Panel title="География" subtitle="Страны посетителей (по IP, без хранения IP)">
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
