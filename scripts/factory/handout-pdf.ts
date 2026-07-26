import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";
import { run } from "./lib/exec.js";
import type { CourseHandout, HandoutDeck, HandoutSlide, Tone } from "./handouts/types.js";

/**
 * CLI: PDF-раздатки уроков в фирменном стиле ACTIVE SALES.
 *
 *   pnpm factory:handout --course sales-shoes [--deck 03] [--keep-html]
 *
 * Колоды описываются данными в scripts/factory/handouts/<slug>.ts (формат — handouts/types.ts),
 * рендерятся в HTML 1280×720 и печатаются headless-Chrome в «Презентации/<Курс>/<урок>/<файл>.pdf»
 * — рядом с транскриптом урока. Ассеты (логотип, фото тренера, SVG-схемы) встраиваются
 * в HTML как data: URI, поэтому PDF самодостаточен.
 *
 * Стиль, макеты и правила контента — docs/PRESENTATIONS.md.
 */

const REPO_ROOT = process.cwd();
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
];

const LOGO = "Презентации/logo-active.webp";
const TRAINER_PHOTO = "Презентации/IMG_6136-2.webp";
const CONTACT = "study@activesales.by";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Подсветить подстроку красным внутри заголовка. */
function highlight(title: string, part?: string): string {
  const safe = esc(title);
  if (!part) return safe;
  const safePart = esc(part);
  return safe.replace(safePart, `<span class="hl">${safePart}</span>`);
}

async function dataUri(relPath: string): Promise<string> {
  const buf = await readFile(join(REPO_ROOT, relPath));
  const ext = relPath.split(".").pop()!.toLowerCase();
  const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

interface Assets {
  logo: string;
  photo: string;
  svgs: Map<string, string>;
}

function toneClass(tone?: Tone): string {
  return `card ${tone ?? "light"}`;
}

function renderSlide(s: HandoutSlide, a: Assets, courseTitle: string): string {
  const foot = `<div class="foot">
      <img class="logo" src="${a.logo}" alt="ACTIVE SALES" />
      <span class="course">${esc(courseTitle)}</span>
      <span class="contact">${CONTACT}</span>
    </div>`;
  const kicker = (text?: string) => (text ? `<div class="kicker"><i></i>${esc(text)}</div>` : "");

  switch (s.layout) {
    case "cover":
      return `<section class="slide cover">
        <div class="cover-left">
          ${kicker(s.kicker)}
          <h1>${esc(s.title)}</h1>
          ${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}
          <div class="cover-foot">
            <span class="lockup"><i class="mark"></i><span><b>ACTIVE SALES</b><em>бизнес-тренинги для менеджеров</em></span></span>
          </div>
        </div>
        <div class="cover-right">
          ${s.photo === false ? "" : `<img class="trainer" src="${a.photo}" alt="Виталий Дубовик" />`}
          <span class="contact light">${CONTACT}</span>
        </div>
      </section>`;

    case "statement":
      return `<section class="slide">
        ${s.watermark ? `<div class="watermark">${esc(s.watermark)}</div>` : ""}
        ${kicker(s.kicker)}
        <div class="body">
          <h2 class="big">${highlight(s.title, s.highlight)}</h2>
          ${s.text ? `<p class="lead">${esc(s.text)}</p>` : ""}
        </div>
        ${foot}
      </section>`;

    case "cards":
      return `<section class="slide">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        ${s.intro ? `<p class="lead small">${esc(s.intro)}</p>` : ""}
        <div class="body"><div class="grid cols-${s.columns ?? 2} ${s.items.length > 6 ? "dense" : ""}">
          ${s.items
            .map(
              (it) => `<div class="${toneClass(it.tone)}">
                ${it.title ? `<h3>${esc(it.title)}</h3>` : ""}
                <p>${esc(it.text)}</p>
              </div>`,
            )
            .join("")}
        </div>
        ${s.banner ? `<div class="banner"><span class="q">“</span>${esc(s.banner)}</div>` : ""}</div>
        ${foot}
      </section>`;

    case "numbered":
      return `<section class="slide">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        ${s.intro ? `<p class="lead small">${esc(s.intro)}</p>` : ""}
        <div class="body"><ol class="numbered cols-${s.columns ?? 2} ${s.items.length > 8 ? "dense" : ""}">
          ${s.items
            .map(
              (it, i) => `<li>
                <span class="n">${String(i + 1).padStart(2, "0")}</span>
                <span class="txt"><b>${esc(it.lead)}</b>${it.text ? ` — ${esc(it.text)}` : ""}</span>
              </li>`,
            )
            .join("")}
        </ol>
        ${s.banner ? `<div class="note">${esc(s.banner)}</div>` : ""}</div>
        ${foot}
      </section>`;

    case "strips":
      return `<section class="slide">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        <div class="body"><div class="strips ${s.items.length > 5 ? "dense" : ""}">
          ${s.items
            .map(
              (t, i) => `<div class="strip ${s.accentLast && i === s.items.length - 1 ? "red" : "dark"}">
                <span class="n">${i + 1}</span><span>${esc(t)}</span>
              </div>`,
            )
            .join("")}
        </div>
        ${s.banner ? `<div class="note">${esc(s.banner)}</div>` : ""}</div>
        ${foot}
      </section>`;

    case "split":
      return `<section class="slide">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        <div class="body"><div class="split">
          ${[s.left, s.right]
            .map(
              (col) => `<div class="col ${col.tone ?? "neutral"}">
                <h3>${esc(col.heading)}</h3>
                <ul>${col.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
              </div>`,
            )
            .join("")}
        </div>
        ${s.banner ? `<div class="banner"><span class="q">“</span>${esc(s.banner)}</div>` : ""}</div>
        ${foot}
      </section>`;

    case "matrix":
      return `<section class="slide">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        <div class="body"><div class="matrix">
          ${s.quadrants
            .map(
              (q) => `<div class="${toneClass(q.tone)}">
                <div class="label">${esc(q.label)}</div>
                <h3>${esc(q.title)}</h3>
                ${q.text ? `<p>${esc(q.text)}</p>` : ""}
              </div>`,
            )
            .join("")}
        </div></div>
        ${foot}
      </section>`;

    case "figure": {
      const svg = a.svgs.get(s.svg) ?? "";
      return `<section class="slide">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        <div class="body"><div class="figure ${s.notes?.length ? "with-notes" : ""}">
          <div class="fig">${svg}${s.caption ? `<div class="cap">${esc(s.caption)}</div>` : ""}</div>
          ${
            s.notes?.length
              ? `<ul class="notes">${s.notes
                  .map((n) => `<li><b>${esc(n.label)}</b><span>${esc(n.text)}</span></li>`)
                  .join("")}</ul>`
              : ""
          }
        </div></div>
        ${foot}
      </section>`;
    }

    case "quote":
      return `<section class="slide quote">
        <div class="quote-mark">”</div>
        ${kicker(s.kicker)}
        <div class="body">
          <blockquote>${esc(s.text)}</blockquote>
          ${s.author ? `<div class="author">${esc(s.author)}</div>` : ""}
        </div>
        ${foot}
      </section>`;

    case "summary":
      return `<section class="slide dark">
        ${kicker(s.kicker)}
        <h2>${esc(s.title)}</h2>
        <div class="body"><div class="strips ${s.items.length > 5 ? "dense" : ""}">
          ${s.items
            .map(
              (t, i) => `<div class="strip ${s.accentLast && i === s.items.length - 1 ? "red" : "soft"}">
                <span class="n">${String(i + 1).padStart(2, "0")}</span><span>${esc(t)}</span>
              </div>`,
            )
            .join("")}
        </div></div>
        <div class="foot">
          <span class="lockup"><i class="mark"></i><span><b>ACTIVE SALES</b><em>бизнес-тренинги для менеджеров</em></span></span>
          <span class="contact light">${CONTACT}</span>
        </div>
      </section>`;
  }
}

const CSS = `
  @page { size: 1280px 720px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
         color: #1B2440; -webkit-font-smoothing: antialiased; }
  .slide { position: relative; width: 1280px; height: 720px; padding: 60px 76px 92px;
           background: #F5F1EC; page-break-after: always; overflow: hidden;
           display: flex; flex-direction: column; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; overflow: hidden; }
  .slide > h2, .slide > .kicker { flex: none; }
  .slide.dark { background: #1B2440; color: #fff; }

  .kicker { display: flex; align-items: center; gap: 14px; font-size: 15px; font-weight: 700;
            letter-spacing: 2.4px; text-transform: uppercase; color: #EE3239; margin-bottom: 20px; }
  .kicker i { display: block; width: 34px; height: 3px; background: #EE3239; border-radius: 2px; }

  h1 { font-size: 66px; line-height: 1.04; letter-spacing: -1.8px; font-weight: 800; }
  h2 { font-size: 44px; line-height: 1.08; letter-spacing: -1.1px; font-weight: 800; margin-bottom: 26px; }
  h2.big { font-size: 58px; line-height: 1.06; max-width: 1000px; }
  .hl { color: #EE3239; }
  .lead { font-size: 27px; line-height: 1.4; color: #4B5563; max-width: 1010px; }
  .lead.small { font-size: 22px; margin-bottom: 22px; }
  .slide.dark .lead { color: #C7CBD8; }
  .watermark { position: absolute; right: 70px; top: 44px; font-size: 190px; font-weight: 800;
               color: #1B2440; opacity: .07; letter-spacing: -8px; }

  /* Обложка */
  .cover { display: grid; grid-template-columns: 57% 43%; padding: 0; background: #1B2440; color: #fff; }
  .cover-left { padding: 78px 64px 62px; display: flex; flex-direction: column; justify-content: center; position: relative; }
  .cover-left .sub { font-size: 25px; line-height: 1.45; color: #B9BFD1; margin-top: 26px; max-width: 560px; }
  .cover-foot { position: absolute; left: 64px; bottom: 56px; }
  .cover-right { position: relative; background: #EFEAE3; display: flex; align-items: flex-end; justify-content: center; }
  .cover-right .trainer { height: 96%; object-fit: contain; object-position: bottom; }
  .cover-right .contact { position: absolute; right: 28px; bottom: 26px; }

  .logo { height: 26px; }
  .logo.big { height: 40px; }

  /* Карточки */
  .grid { display: grid; gap: 18px; }
  .grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .card { border-radius: 14px; padding: 22px 24px; background: #fff; box-shadow: 0 1px 3px rgba(27,36,64,.08); }
  .card.dark { background: #1B2440; color: #fff; }
  .card.red { background: #EE3239; color: #fff; }
  .card.dashed { background: transparent; border: 2px dashed #C9C3BA; box-shadow: none; }
  .grid.dense { gap: 13px; }
  .grid.dense .card { padding: 15px 20px; }
  .grid.dense .card h3 { font-size: 20px; margin-bottom: 5px; }
  .grid.dense .card p { font-size: 18px; line-height: 1.3; }
  .card h3 { font-size: 23px; font-weight: 700; margin-bottom: 8px; }
  .card p { font-size: 20px; line-height: 1.36; color: #4B5563; }
  .card.dark p, .card.red p { color: rgba(255,255,255,.9); }

  .banner { margin-top: 22px; background: #EE3239; color: #fff; border-radius: 12px;
            padding: 20px 26px; font-size: 21px; line-height: 1.35; display: flex; gap: 14px; align-items: flex-start; }
  .banner .q { font-size: 34px; line-height: .8; opacity: .7; }
  .note { margin-top: 22px; padding-left: 18px; border-left: 4px solid #EE3239; font-size: 20px; color: #4B5563; line-height: 1.35; }

  /* Нумерованные списки */
  .numbered { list-style: none; display: grid; gap: 16px 40px; }
  .numbered.cols-2 { grid-template-columns: 1fr 1fr; }
  .numbered li { display: flex; gap: 14px; align-items: baseline; font-size: 21px; line-height: 1.34; }
  .numbered.dense { gap: 11px 34px; }
  .numbered.dense li { font-size: 18px; line-height: 1.3; }
  .numbered .n { flex: none; font-size: 17px; font-weight: 800; color: #EE3239; letter-spacing: .5px; }
  .numbered .txt b { font-weight: 700; }
  .numbered .txt { color: #4B5563; }
  .numbered .txt b { color: #1B2440; }

  /* Плашки-строки */
  .strips { display: flex; flex-direction: column; gap: 13px; }
  .strip { display: flex; align-items: center; gap: 20px; border-radius: 12px; padding: 18px 24px;
           font-size: 22px; line-height: 1.3; }
  .strips.dense { gap: 9px; }
  .strips.dense .strip { padding: 12px 20px; font-size: 19px; }
  .strip .n { font-weight: 800; font-size: 19px; opacity: .85; min-width: 26px; }
  .strip.dark { background: #1B2440; color: #fff; }
  .strip.dark .n { color: #EE3239; opacity: 1; }
  .strip.red { background: #EE3239; color: #fff; }
  .strip.soft { background: rgba(255,255,255,.08); color: #fff; }
  .strip.soft .n { color: #EE3239; opacity: 1; }

  /* Две колонки-сравнения */
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .split .col { border-radius: 14px; padding: 24px 26px; background: #fff; box-shadow: 0 1px 3px rgba(27,36,64,.08); }
  .split .col.good { background: #ECFDF3; box-shadow: inset 0 0 0 2px #A7E8C0; }
  .split .col.bad { background: #FEF2F2; box-shadow: inset 0 0 0 2px #FCC8C8; }
  .split .col h3 { font-size: 24px; font-weight: 700; margin-bottom: 14px; }
  .split .col.good h3 { color: #047857; }
  .split .col.bad h3 { color: #B91C1C; }
  .split .col ul { list-style: none; display: flex; flex-direction: column; gap: 11px; }
  .split .col li { position: relative; padding-left: 22px; font-size: 20px; line-height: 1.32; color: #4B5563; }
  .split .col li::before { content: ""; position: absolute; left: 0; top: 11px; width: 9px; height: 9px;
                           border-radius: 50%; background: #CBD5E1; }
  .split .col.good li::before { background: #10B981; }
  .split .col.bad li::before { background: #EF4444; }

  /* Матрица */
  .matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .matrix .card { min-height: 148px; }
  .matrix .label { font-size: 14px; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase;
                   color: #EE3239; margin-bottom: 10px; }
  .matrix .card.dark .label, .matrix .card.red .label { color: rgba(255,255,255,.85); }

  /* Схема */
  .figure { display: grid; gap: 26px; align-items: center; }
  .figure.with-notes { grid-template-columns: 58% 1fr; }
  .figure .fig { background: #fff; border-radius: 16px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(27,36,64,.08); }
  .figure .fig svg { width: 100%; height: auto; display: block; }
  .figure .cap { font-size: 15px; color: #6B7280; text-align: center; padding-bottom: 6px; }
  .notes { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .notes li { display: flex; flex-direction: column; gap: 3px; font-size: 18px; line-height: 1.3; }
  .notes b { font-size: 18px; color: #1B2440; }
  .notes span { color: #4B5563; }

  /* Цитата */
  .quote blockquote { font-size: 48px; line-height: 1.22; font-weight: 800; letter-spacing: -1px; max-width: 1000px; }
  .quote .author { margin-top: 26px; font-size: 22px; color: #6B7280; }
  .quote-mark { position: absolute; right: 76px; top: 40px; font-size: 260px; line-height: .8; font-weight: 800;
                color: #1B2440; opacity: .06; }

  /* Футер */
  .foot { position: absolute; left: 76px; right: 76px; bottom: 40px; display: flex; align-items: center; gap: 18px; }
  .foot .course { font-size: 15px; color: #9CA3AF; }
  .foot .contact { margin-left: auto; font-size: 15px; color: #9CA3AF; }
  .contact.light { color: rgba(255,255,255,.55); font-size: 15px; }
  .lockup { display: inline-flex; align-items: center; gap: 12px; }
  .lockup .mark { display: block; width: 30px; height: 30px; border-radius: 5px; background: #EE3239; position: relative; }
  .lockup .mark::after { content: "↗"; position: absolute; inset: 0; display: flex; align-items: center;
                         justify-content: center; color: #fff; font-size: 17px; font-weight: 700; }
  .lockup b { display: block; font-size: 19px; letter-spacing: 1.6px; font-weight: 800; color: #fff; }
  .lockup em { display: block; font-style: normal; font-size: 11px; letter-spacing: .6px; color: rgba(255,255,255,.6); }
`;

function renderDeck(deck: HandoutDeck, a: Assets, courseTitle: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(deck.file)}</title>
<style>${CSS}</style></head><body>
${deck.slides.map((s) => renderSlide(s, a, courseTitle)).join("\n")}
</body></html>`;
}

async function findChrome(): Promise<string> {
  for (const cand of CHROME_CANDIDATES) {
    if (cand.startsWith("/") && existsSync(cand)) return cand;
    if (!cand.startsWith("/")) {
      const ok = await run(cand, ["--version"]).then(
        () => true,
        () => false,
      );
      if (ok) return cand;
    }
  }
  throw new Error("Не найден Chrome/Chromium для печати PDF (установите Google Chrome)");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = typeof args.options.course === "string" ? args.options.course : null;
  if (!slug) throw new Error("Укажите --course <slug> (например sales-shoes)");
  const only = typeof args.options.deck === "string" ? args.options.deck : null;
  const keepHtml = Boolean(args.options["keep-html"]);

  const mod = (await import(`./handouts/${slug}.js`)) as { HANDOUT: CourseHandout };
  const handout = mod.HANDOUT;

  const svgPaths = new Set<string>();
  for (const d of handout.decks) for (const s of d.slides) if (s.layout === "figure") svgPaths.add(s.svg);
  const svgs = new Map<string, string>();
  for (const p of svgPaths) svgs.set(p, await readFile(join(REPO_ROOT, p), "utf8"));

  const assets: Assets = { logo: await dataUri(LOGO), photo: await dataUri(TRAINER_PHOTO), svgs };
  const chrome = await findChrome();
  const tmp = await mkdtemp(join(tmpdir(), "salesup-handout-"));

  let made = 0;
  for (const deck of handout.decks) {
    if (only && !deck.dir.startsWith(only)) continue;
    const html = renderDeck(deck, assets, handout.courseTitle);
    const htmlPath = join(keepHtml ? join(REPO_ROOT, "Презентации", handout.folder, deck.dir) : tmp, `${deck.file}.html`);
    const outDir = join(REPO_ROOT, "Презентации", handout.folder, deck.dir);
    await mkdir(outDir, { recursive: true });
    await writeFile(htmlPath, html, "utf8");

    const pdfPath = join(outDir, `${deck.file}.pdf`);
    log.step(`${deck.dir}: ${deck.slides.length} слайдов`);
    await run(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file://${encodeURI(htmlPath)}`,
    ]);
    log.info(`  → ${c.dim(pdfPath)}`);
    made += 1;
  }
  await rm(tmp, { recursive: true, force: true });
  log.ok(`Готово: ${made} PDF-раздаток курса ${handout.slug}`);
}

main().catch((e) => {
  log.err(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
