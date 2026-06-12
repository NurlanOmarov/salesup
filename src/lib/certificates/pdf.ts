import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

/**
 * Генерация PDF именного сертификата (S5.3). A4 landscape, шрифт Roboto с кириллицей
 * (встраивается через fontkit — стандартные шрифты PDF кириллицу не содержат).
 * QR-код ведёт на публичную страницу проверки /verify/<hash>.
 *
 * Шрифты лежат в src/assets/fonts и копируются в standalone через
 * outputFileTracingIncludes (next.config). Читаем относительно process.cwd().
 */

const FONT_DIR = join(process.cwd(), "src/assets/fonts");

export interface CertificateData {
  holderName: string;
  courseTitle: string;
  number: string;
  hoursLabel: string | null;
  scorePct: number | null;
  issuedAt: Date;
  verifyUrl: string;
}

const AMBER = rgb(0.96, 0.62, 0.04);
const DARK = rgb(0.02, 0.025, 0.09);
const GRAY = rgb(0.42, 0.45, 0.5);

export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, "Roboto-Regular.ttf")),
    readFile(join(FONT_DIR, "Roboto-Bold.ttf")),
  ]);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontRegular = await pdf.embedFont(regular);
  const fontBold = await pdf.embedFont(bold);

  // A4 landscape
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();

  // Рамка
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: AMBER, borderWidth: 2 });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: rgb(0.9, 0.9, 0.92), borderWidth: 1 });

  const center = (text: string, y: number, size: number, font = fontRegular, color = DARK) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  // Бренд
  center("SALESACADEMY", height - 90, 16, fontBold, AMBER);

  // Заголовок
  center("СЕРТИФИКАТ", height - 150, 40, fontBold, DARK);
  center("подтверждает, что", height - 185, 14, fontRegular, GRAY);

  // ФИО
  center(data.holderName, height - 240, 32, fontBold, DARK);

  // Курс
  center("успешно прошёл(ла) курс", height - 280, 14, fontRegular, GRAY);
  // длинное название переносим по ширине
  const courseSize = 22;
  const maxW = width - 160;
  let title = data.courseTitle;
  while (fontBold.widthOfTextAtSize(title, courseSize) > maxW && title.length > 4) {
    title = title.slice(0, -2);
  }
  if (title !== data.courseTitle) title = title.slice(0, -1) + "…";
  center(`«${title}»`, height - 320, courseSize, fontBold, DARK);

  // Детали
  const details: string[] = [];
  if (data.hoursLabel) details.push(`Объём: ${data.hoursLabel}`);
  if (data.scorePct != null) details.push(`Результат экзамена: ${data.scorePct}%`);
  details.push(`Дата выдачи: ${data.issuedAt.toLocaleDateString("ru-RU")}`);
  center(details.join("   ·   "), height - 365, 13, fontRegular, GRAY);

  // Номер
  center(`Сертификат № ${data.number}`, 90, 12, fontRegular, GRAY);
  center("Проверка подлинности по QR-коду", 72, 10, fontRegular, GRAY);

  // QR-код
  const qrPng = await QRCode.toBuffer(data.verifyUrl, { type: "png", margin: 1, width: 220 });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 90;
  page.drawImage(qrImage, { x: width - 130, y: 64, width: qrSize, height: qrSize });

  return pdf.save();
}
