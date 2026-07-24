import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Dashboard } from "@/lib/analytics/dashboard";
import { countryName, fmtInt, fmtPct, fmtDelta } from "@/lib/analytics/format";

/**
 * Экспорт дашборда в PDF. Кириллица — через встроенный Roboto (fontkit); стандартные
 * PDF-шрифты кириллицу не содержат. Шрифты те же, что у сертификатов (src/assets/fonts,
 * копируются в standalone через outputFileTracingIncludes).
 */

const FONT_DIR = join(process.cwd(), "src/assets/fonts");
const BRAND = rgb(0.956, 0, 0.227);
const DARK = rgb(0.04, 0.04, 0.09);
const GRAY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.9, 0.9, 0.92);
const HEAD_BG = rgb(0.04, 0.04, 0.04);

const MARGIN = 40;
const PAGE_W = 595;
const PAGE_H = 842;

export async function buildPdf(d: Dashboard): Promise<Uint8Array> {
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, "Roboto-Regular.ttf")),
    readFile(join(FONT_DIR, "Roboto-Bold.ttf")),
  ]);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(regular);
  const fontBold = await pdf.embedFont(bold);

  const ctx = new Ctx(pdf, font, fontBold);

  // Заголовок
  ctx.text("ACTIVE SALES", MARGIN, ctx.y, 12, fontBold, BRAND);
  ctx.y -= 22;
  ctx.text("Отчёт по аналитике", MARGIN, ctx.y, 22, fontBold, DARK);
  ctx.y -= 18;
  ctx.text(`Период: ${d.range.from} — ${d.range.to}`, MARGIN, ctx.y, 10, font, GRAY);
  ctx.y -= 24;

  // KPI-таблица
  ctx.heading("Ключевые показатели");
  const kpiHeader = d.range.compare ? ["Показатель", "Значение", "Прошлый период", "Прирост"] : ["Показатель", "Значение"];
  const kpiRows = [
    ["Посетители", fmtInt(d.kpis.visitors.value), d.kpis.visitors],
    ["Просмотры", fmtInt(d.kpis.views.value), d.kpis.views],
    ["Заявки", fmtInt(d.kpis.leads.value), d.kpis.leads],
    ["Записи", fmtInt(d.kpis.enrollments.value), d.kpis.enrollments],
    ["Конверсия", fmtPct(d.kpis.conversion.value), d.kpis.conversion],
  ].map(([label, value, metric]) => {
    const m = metric as Dashboard["kpis"]["visitors"];
    return d.range.compare
      ? [label as string, value as string, m.prev !== null ? fmtInt(m.prev) : "—", m.deltaPct !== null ? fmtDelta(m.deltaPct) : "—"]
      : [label as string, value as string];
  });
  ctx.table(kpiHeader, kpiRows, d.range.compare ? [150, 110, 130, 100] : [200, 200]);

  // Курсы
  ctx.heading("Популярность курсов");
  if (d.courses.length) {
    ctx.table(
      ["Курс", "Просм.", "Заявки", "Записи", "Конв."],
      d.courses.slice(0, 15).map((c) => [c.title, fmtInt(c.views), fmtInt(c.leads), fmtInt(c.enrollments), fmtPct(c.conversion)]),
      [235, 70, 70, 70, 70],
    );
  } else ctx.muted("Нет данных за период.");

  // Страны
  ctx.heading("География");
  if (d.countries.length) {
    ctx.table(
      ["Страна", "Посетители", "Просмотры"],
      d.countries.map((c) => [`${countryName(c.key)} (${c.key})`, fmtInt(c.visitors ?? 0), fmtInt(c.value)]),
      [255, 130, 130],
    );
  } else ctx.muted("Нет данных за период.");

  // Источники
  ctx.heading("Источники трафика");
  if (d.sources.length) {
    ctx.table(
      ["Источник", "Переходы"],
      d.sources.map((s) => [s.label, fmtInt(s.value)]),
      [385, 130],
    );
  } else ctx.muted("Прямые заходы или нет внешних переходов.");

  ctx.footer();
  return pdf.save();
}

/** Курсор рисования с автопереносом на новую страницу. */
class Ctx {
  page: PDFPage;
  y: number;
  constructor(
    private pdf: PDFDocument,
    private font: PDFFont,
    private fontBold: PDFFont,
  ) {
    this.page = pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private ensure(space: number) {
    if (this.y - space < MARGIN + 30) {
      this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN;
    }
  }

  text(t: string, x: number, y: number, size: number, font: PDFFont, color = DARK) {
    this.page.drawText(t, { x, y, size, font, color });
  }

  heading(t: string) {
    this.ensure(40);
    this.y -= 20;
    this.text(t, MARGIN, this.y, 13, this.fontBold, DARK);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 1,
      color: BRAND,
    });
    this.y -= 12;
  }

  muted(t: string) {
    this.text(t, MARGIN, this.y, 10, this.font, GRAY);
    this.y -= 16;
  }

  /** Таблица с шапкой и строками; colWidths — ширины колонок в пунктах. */
  table(header: string[], rows: string[][], colWidths: number[]) {
    const rowH = 20;
    // Шапка
    this.ensure(rowH);
    this.page.drawRectangle({ x: MARGIN, y: this.y - rowH + 4, width: PAGE_W - MARGIN * 2, height: rowH, color: HEAD_BG });
    let x = MARGIN + 6;
    header.forEach((h, i) => {
      this.text(this.clip(h, colWidths[i]! - 8, 9, this.fontBold), x, this.y - rowH + 10, 9, this.fontBold, rgb(1, 1, 1));
      x += colWidths[i]!;
    });
    this.y -= rowH;

    rows.forEach((row, ri) => {
      this.ensure(rowH);
      if (ri % 2 === 1) {
        this.page.drawRectangle({ x: MARGIN, y: this.y - rowH + 4, width: PAGE_W - MARGIN * 2, height: rowH, color: rgb(0.97, 0.97, 0.98) });
      }
      let cx = MARGIN + 6;
      row.forEach((cell, ci) => {
        this.text(this.clip(cell, colWidths[ci]! - 8, 9, this.font), cx, this.y - rowH + 10, 9, this.font, DARK);
        cx += colWidths[ci]!;
      });
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - rowH + 4 },
        end: { x: PAGE_W - MARGIN, y: this.y - rowH + 4 },
        thickness: 0.5,
        color: LINE,
      });
      this.y -= rowH;
    });
    this.y -= 6;
  }

  /** Обрезает текст многоточием под заданную ширину. */
  private clip(t: string, maxW: number, size: number, font: PDFFont): string {
    if (font.widthOfTextAtSize(t, size) <= maxW) return t;
    let s = t;
    while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxW) s = s.slice(0, -1);
    return s + "…";
  }

  footer() {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(`ACTIVE SALES · стр. ${i + 1} из ${pages.length}`, {
        x: MARGIN,
        y: 24,
        size: 8,
        font: this.font,
        color: GRAY,
      });
    });
  }
}
