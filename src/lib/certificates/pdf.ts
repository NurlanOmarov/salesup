import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

/**
 * PDF именного сертификата по образцу школы (D-019): фон — макет ACTIVE SALES
 * (красная полоса с логотипом, серое поле с заголовком «СЕРТИФИКАТ»), печать с
 * подписью автора курса — из того же образца (src/assets/certificate). Текст
 * верстаем сами поверх серого поля: ФИО, организация, что пройдено, номер, QR.
 *
 * A4 landscape, шрифт Roboto с кириллицей (встраивается через fontkit —
 * стандартные шрифты PDF кириллицу не содержат). Ассеты копируются в standalone
 * через outputFileTracingIncludes (next.config), читаем относительно process.cwd().
 */

const ASSETS = join(process.cwd(), "src/assets");

export interface CertificateData {
  holderName: string;
  /** Организация работника (B2B) — строкой под ФИО, как в образце. */
  orgName?: string | null;
  /** «прошёл» / «прошла» / «прошёл(ла)» — lib/certificates/holder.passedVerb. */
  verb: string;
  /** Что пройдено: «бизнес-курс онлайн» / «вводную часть бизнес-курса онлайн». */
  lead: string;
  courseTitle: string;
  number: string;
  verifyUrl: string;
}

const DARK = rgb(0.2, 0.21, 0.23);
const GRAY = rgb(0.42, 0.44, 0.47);
const RED = rgb(0.89, 0.12, 0.15);

// Серое поле макета (в пунктах, начало координат — левый нижний угол листа).
const PANEL = { left: 274, right: 808, top: 552, bottom: 44 };
const PANEL_CX = (PANEL.left + PANEL.right) / 2;
const TEXT_W = PANEL.right - PANEL.left - 56;

/** Строки, влезающие в ширину: переносим по словам. */
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Размер шрифта, при котором одна строка влезает в ширину (не меньше min). */
function fitSize(text: string, font: PDFFont, size: number, maxW: number, min: number): number {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  return s;
}

function center(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color = DARK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: PANEL_CX - w / 2, y, size, font, color });
}

export async function renderCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const [regular, bold, bg, stamp] = await Promise.all([
    readFile(join(ASSETS, "fonts/Roboto-Regular.ttf")),
    readFile(join(ASSETS, "fonts/Roboto-Bold.ttf")),
    readFile(join(ASSETS, "certificate/background.jpg")),
    readFile(join(ASSETS, "certificate/stamp.png")),
  ]);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Сертификат № ${data.number}`);
  pdf.setAuthor("ACTIVE SALES");
  const fReg = await pdf.embedFont(regular, { subset: true });
  const fBold = await pdf.embedFont(bold, { subset: true });

  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();
  page.drawImage(await pdf.embedJpg(bg), { x: 0, y: 0, width, height });

  // Номер — сразу под заголовком «СЕРТИФИКАТ» макета.
  center(page, `№ ${data.number}`, 432, 13, fReg, GRAY);
  center(page, "свидетельствует о том, что", 398, 14, fReg, GRAY);

  // ФИО — главная строка; длинное уменьшаем, в крайнем случае переносим.
  let y = 352;
  const nameSize = fitSize(data.holderName, fBold, 30, TEXT_W, 20);
  for (const line of wrap(data.holderName, fBold, nameSize, TEXT_W)) {
    center(page, line, y, nameSize, fBold, DARK);
    y -= nameSize + 6;
  }

  if (data.orgName) {
    center(page, data.orgName, y + 2, 15, fReg, GRAY);
    y -= 24;
  }

  y -= 8;
  for (const line of wrap(`успешно ${data.verb} ${data.lead}`, fReg, 15, TEXT_W)) {
    center(page, line, y, 15, fReg, DARK);
    y -= 21;
  }

  y -= 6;
  const titleSize = fitSize(`«${data.courseTitle}»`, fBold, 22, TEXT_W, 16);
  for (const line of wrap(`«${data.courseTitle}»`, fBold, titleSize, TEXT_W)) {
    center(page, line, y, titleSize, fBold, RED);
    y -= titleSize + 6;
  }

  y -= 10;
  center(page, "в международном консалтинговом агентстве ACTIVE SALES", y, 13, fReg, DARK);
  center(page, "activesales.by  |  sales-active.ru  |  activesales.kz  |  activesales.uz", y - 18, 10, fReg, GRAY);

  // Печать с подписью автора курса — правый нижний угол серого поля.
  const stampImg = await pdf.embedPng(stamp);
  const stampW = 190;
  const stampH = (stampW * stampImg.height) / stampImg.width;
  page.drawImage(stampImg, { x: PANEL.right - stampW - 24, y: PANEL.bottom + 14, width: stampW, height: stampH });

  // QR на страницу проверки подлинности — левый нижний угол серого поля.
  const qrPng = await QRCode.toBuffer(data.verifyUrl, { type: "png", margin: 1, width: 240 });
  const qr = await pdf.embedPng(qrPng);
  const qrSize = 64;
  const qrX = PANEL.left + 26;
  const qrY = PANEL.bottom + 30;
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawText("Проверка подлинности:", { x: qrX + qrSize + 10, y: qrY + 36, size: 9, font: fReg, color: GRAY });
  page.drawText("наведите камеру на QR-код", { x: qrX + qrSize + 10, y: qrY + 24, size: 9, font: fReg, color: GRAY });

  return pdf.save();
}
