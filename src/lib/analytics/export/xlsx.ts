import "server-only";
import ExcelJS from "exceljs";
import type { Dashboard, SiteBreakdownRow } from "@/lib/analytics/dashboard";
import { countryName } from "@/lib/analytics/format";

/**
 * Экспорт дашборда в XLSX. Кириллица — из коробки (UTF-8). Несколько листов:
 * сводка KPI, по дням, курсы, страны, страницы, источники (+ «По доменам»,
 * когда выгрузка сделана без фильтра по домену).
 */
export async function buildXlsx(
  d: Dashboard,
  siteLabel: string,
  breakdown: SiteBreakdownRow[] | null,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ACTIVE SALES";
  wb.created = new Date();

  const periodLabel = `${d.range.from} — ${d.range.to}`;

  // ——— Сводка ———
  const summary = wb.addWorksheet("Сводка");
  summary.columns = [
    { header: "Показатель", key: "m", width: 24 },
    { header: "Значение", key: "v", width: 16 },
    { header: "Прошлый период", key: "p", width: 18 },
    { header: "Прирост, %", key: "d", width: 14 },
  ];
  summary.spliceRows(1, 0, [`Аналитика ACTIVE SALES`], [`Домен: ${siteLabel}`], [`Период: ${periodLabel}`], []);
  summary.getRow(1).font = { bold: true, size: 14 };
  styleHeader(summary.getRow(5));
  const kpiRows: [string, number, typeof d.kpis.visitors][] = [
    ["Посетители", d.kpis.visitors.value, d.kpis.visitors],
    ["Просмотры", d.kpis.views.value, d.kpis.views],
    ["Заявки", d.kpis.leads.value, d.kpis.leads],
    ["Записи", d.kpis.enrollments.value, d.kpis.enrollments],
    ["Конверсия, %", d.kpis.conversion.value, d.kpis.conversion],
  ];
  for (const [label, value, metric] of kpiRows) {
    summary.addRow({ m: label, v: value, p: metric.prev ?? "—", d: metric.deltaPct ?? "—" });
  }

  // ——— По дням ———
  const daily = wb.addWorksheet("По дням");
  daily.columns = [
    { header: "Дата", key: "date", width: 14 },
    { header: "Посетители", key: "visitors", width: 14 },
    { header: "Просмотры", key: "views", width: 14 },
  ];
  styleHeader(daily.getRow(1));
  for (const p of d.timeseries) daily.addRow({ date: p.date, visitors: p.visitors, views: p.views });

  // ——— Курсы ———
  const courses = wb.addWorksheet("Курсы");
  courses.columns = [
    { header: "Курс", key: "title", width: 40 },
    { header: "Просмотры", key: "views", width: 12 },
    { header: "Посетители", key: "visitors", width: 12 },
    { header: "Заявки", key: "leads", width: 10 },
    { header: "Записи", key: "enrollments", width: 10 },
    { header: "Конверсия, %", key: "conversion", width: 14 },
  ];
  styleHeader(courses.getRow(1));
  for (const c of d.courses) courses.addRow(c);

  // ——— Страны ———
  const countries = wb.addWorksheet("Страны");
  countries.columns = [
    { header: "Страна", key: "name", width: 28 },
    { header: "Код", key: "code", width: 8 },
    { header: "Посетители", key: "visitors", width: 14 },
    { header: "Просмотры", key: "views", width: 14 },
  ];
  styleHeader(countries.getRow(1));
  for (const c of d.countries) {
    countries.addRow({ name: countryName(c.key), code: c.key, visitors: c.visitors ?? 0, views: c.value });
  }

  // ——— Страницы ———
  const pages = wb.addWorksheet("Страницы");
  pages.columns = [
    { header: "Путь", key: "path", width: 44 },
    { header: "Просмотры", key: "views", width: 14 },
    { header: "Посетители", key: "visitors", width: 14 },
  ];
  styleHeader(pages.getRow(1));
  for (const p of d.pages) pages.addRow({ path: p.label, views: p.value, visitors: p.visitors ?? 0 });

  // ——— Источники ———
  const sources = wb.addWorksheet("Источники");
  sources.columns = [
    { header: "Источник", key: "ref", width: 32 },
    { header: "Переходы", key: "views", width: 14 },
  ];
  styleHeader(sources.getRow(1));
  for (const s of d.sources) sources.addRow({ ref: s.label, views: s.value });

  // ——— По доменам (только когда выгрузка без фильтра — «Все домены») ———
  if (breakdown) {
    const bySite = wb.addWorksheet("По доменам");
    bySite.columns = [
      { header: "Домен", key: "label", width: 24 },
      { header: "Посетители", key: "visitors", width: 14 },
      { header: "Заявки", key: "leads", width: 12 },
      { header: "Записи", key: "enrollments", width: 12 },
      { header: "Конверсия, %", key: "conversion", width: 14 },
    ];
    styleHeader(bySite.getRow(1));
    for (const r of breakdown) bySite.addRow(r);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } };
  row.alignment = { vertical: "middle" };
}
