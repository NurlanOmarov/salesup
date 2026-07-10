import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ChecklistData } from "@/lib/interactive";

/**
 * Генерация PDF учебного материала урока (конспект / чек-лист) для скачивания.
 * A4 portrait, шрифт Roboto с кириллицей (как в сертификате — стандартные шрифты PDF
 * кириллицу не содержат). Простой layout: заголовки, абзацы, маркеры; перенос строк и
 * пагинация. Markdown упрощается до текста (заголовки/списки/выделение).
 */

const FONT_DIR = join(process.cwd(), "src/assets/fonts");
const AMBER = rgb(0.96, 0.62, 0.04);
const DARK = rgb(0.08, 0.09, 0.13);
const GRAY = rgb(0.42, 0.45, 0.5);

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Block {
  text: string;
  size: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  gap: number; // отступ сверху перед блоком
  bullet?: boolean;
}

/** Markdown-конспект → последовательность блоков для верстки. */
function summaryToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const stripped = stripInline(line.trim());
    if (line.startsWith("### ")) {
      blocks.push({ text: stripInline(line.slice(4)), size: 13, bold: true, gap: 12 });
    } else if (line.startsWith("## ")) {
      blocks.push({ text: stripInline(line.slice(3)), size: 16, bold: true, gap: 16 });
    } else if (line.startsWith("# ")) {
      blocks.push({ text: stripInline(line.slice(2)), size: 18, bold: true, gap: 16 });
    } else if (/^[-*]\s+/.test(line.trim())) {
      blocks.push({ text: stripInline(line.trim().replace(/^[-*]\s+/, "")), size: 11, gap: 6, bullet: true });
    } else if (/^\d+\.\s+/.test(line.trim())) {
      blocks.push({ text: stripInline(line.trim()), size: 11, gap: 6 });
    } else {
      blocks.push({ text: stripped, size: 11, gap: 8 });
    }
  }
  return blocks;
}

/** Убираем markdown-разметку выделения, оставляя текст. */
function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

function checklistToBlocks(data: ChecklistData): Block[] {
  const blocks: Block[] = [];
  for (const item of data.items) {
    blocks.push({ text: `☐  ${item.text}`, size: 12, gap: 10 });
    if (item.hint) blocks.push({ text: item.hint, size: 10, color: GRAY, gap: 2 });
  }
  return blocks;
}

/** Разбивка строки на строки по ширине (перенос по словам). */
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface MaterialPdfInput {
  courseTitle: string;
  lessonTitle: string;
  heading: string; // «Конспект» | «Чек-лист подготовки»
  summary?: string | null;
  checklist?: ChecklistData | null;
}

export async function renderMaterialPdf(input: MaterialPdfInput): Promise<Uint8Array> {
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, "Roboto-Regular.ttf")),
    readFile(join(FONT_DIR, "Roboto-Bold.ttf")),
  ]);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontRegular = await pdf.embedFont(regular);
  const fontBold = await pdf.embedFont(bold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  // Шапка
  page.drawText("SALESACADEMY", { x: MARGIN, y, size: 11, font: fontBold, color: AMBER });
  y -= 22;
  for (const ln of wrap(input.lessonTitle, fontBold, 20, CONTENT_W)) {
    page.drawText(ln, { x: MARGIN, y, size: 20, font: fontBold, color: DARK });
    y -= 26;
  }
  page.drawText(`${input.heading} · ${input.courseTitle}`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontRegular,
    color: GRAY,
  });
  y -= 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.92),
  });
  y -= 18;

  const blocks = input.summary
    ? summaryToBlocks(input.summary)
    : input.checklist
      ? checklistToBlocks(input.checklist)
      : [];

  for (const b of blocks) {
    const font = b.bold ? fontBold : fontRegular;
    const color = b.color ?? DARK;
    const indent = b.bullet ? 16 : 0;
    const lineH = b.size + 5;

    y -= b.gap;
    const lines = wrap(b.text, font, b.size, CONTENT_W - indent);
    for (let i = 0; i < lines.length; i++) {
      if (y < MARGIN + lineH) newPage();
      if (b.bullet && i === 0) {
        page.drawText("•", { x: MARGIN, y, size: b.size, font: fontBold, color: AMBER });
      }
      page.drawText(lines[i]!, { x: MARGIN + indent, y, size: b.size, font, color });
      y -= lineH;
    }
  }

  return pdf.save();
}
