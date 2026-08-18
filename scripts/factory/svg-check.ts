import { readdir } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { chromium } from "@playwright/test";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: контроль вёрстки схем-иллюстраций (public/images/<курс>/*.svg).
 *
 *   pnpm factory:check-svg                 # все схемы
 *   pnpm factory:check-svg --dir public/images/tourism
 *
 * Зачем. Схемы рисуются вручную, а ширину строки на глаз не посчитать: подпись
 * вылезает за прямоугольник или за скошенную грань трапеции — и это видно только
 * на проде. Скрипт открывает SVG в headless-браузере и меряет по-настоящему:
 *   • getComputedTextLength() — фактическая ширина каждой надписи;
 *   • isPointInFill() — попадает ли начало/конец строки внутрь той же фигуры,
 *     что и её середина (для трапеций это учитывает скос на нужной высоте).
 *
 * Правила, которые проверяются:
 *   1. надпись не выходит за холст (viewBox) и не жмётся к краю ближе SAFE_EDGE;
 *   2. если середина надписи лежит внутри фигуры — оба конца тоже лежат в ней;
 *   3. у схемы есть светлая подложка: тёмный текст обязан читаться и в тёмной
 *      теме кабинета, и на белой раздатке.
 *
 * Выход 1 при любой найденной проблеме — чтобы падало в проверке перед коммитом.
 */

const SAFE_EDGE = 8; // минимальный отступ надписи от края холста, px viewBox

/** Код меряет надписи прямо в браузере: строкой, потому что сборка tsx
 *  добавляет в функции хелпер __name, которого нет на странице. */
const MEASURE_JS = `(safeEdge) => {
      const svg = document.querySelector("svg");
      if (!svg) return { texts: 0, problems: [{ kind: "canvas", text: "", detail: "в файле нет <svg>" }] };
      const vb = svg.viewBox.baseVal;
      const shapes = [...svg.querySelectorAll("rect, path, polygon, circle, ellipse")];

      // Подложка — фигура, закрывающая почти весь холст непрозрачной заливкой.
      const hasPlate = shapes.some((s) => {
        const b = s.getBBox();
        const fill = getComputedStyle(s).fill;
        const covers = b.width >= vb.width * 0.95 && b.height >= vb.height * 0.95;
        return covers && fill !== "none" && !fill.includes("rgba(0, 0, 0, 0)");
      });

      const found = [];
      const texts = [...svg.querySelectorAll("text")];

      for (const t of texts) {
        const label = (t.textContent ?? "").trim();
        if (!label) continue;
        // Повёрнутые надписи меряем отдельно — их габарит даёт getBoundingClientRect.
        if (t.getAttribute("transform")) continue;

        const len = t.getComputedTextLength();
        const anchor = getComputedStyle(t).textAnchor || "start";
        const x = Number(t.getAttribute("x") ?? 0);
        const y = Number(t.getAttribute("y") ?? 0);
        const x1 = anchor === "middle" ? x - len / 2 : anchor === "end" ? x - len : x;
        const x2 = x1 + len;
        const size = parseFloat(getComputedStyle(t).fontSize) || 13;
        const yMid = y - size * 0.32; // визуальная середина строки

        if (x1 < safeEdge || x2 > vb.width - safeEdge) {
          found.push({
            kind: "canvas",
            text: label,
            detail: \`x \${Math.round(x1)}..\${Math.round(x2)} при холсте 0..\${vb.width} (нужен отступ ≥\${safeEdge})\`,
          });
          continue;
        }

        const pt = svg.createSVGPoint();
        const inside = (px) => {
          pt.x = px;
          pt.y = yMid;
          return shapes.filter((s) => {
            const b = s.getBBox();
            if (b.width >= vb.width * 0.95 && b.height >= vb.height * 0.95) return false; // подложка
            try {
              return s.isPointInFill(pt);
            } catch {
              return false;
            }
          });
        };

        const host = inside((x1 + x2) / 2)[0];
        if (!host) continue; // свободная подпись — достаточно проверки холста

        for (const [edge, px] of [["слева", x1 + 2], ["справа", x2 - 2]]) {
          if (!inside(px).includes(host)) {
            found.push({
              kind: "shape",
              text: label,
              detail: \`выходит \${edge} за «\${host.getAttribute("class") ?? host.tagName}» (строка x \${Math.round(x1)}..\${Math.round(x2)})\`,
            });
          }
        }
      }

      if (!hasPlate) {
        found.push({ kind: "plate", text: "", detail: "нет светлой подложки — тёмный текст пропадёт в тёмной теме" });
      }
      return { texts: texts.length, problems: found };
}`;

interface Problem {
  file: string;
  kind: "canvas" | "shape" | "plate";
  text: string;
  detail: string;
}

async function listSvgs(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listSvgs(full)));
    else if (entry.name.endsWith(".svg")) out.push(full);
  }
  return out.sort();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const dirArg = typeof args.options.dir === "string" ? args.options.dir : "public/images";
  const dir = isAbsolute(dirArg) ? dirArg : join(root, dirArg);

  const files = await listSvgs(dir);
  if (files.length === 0) throw new Error(`SVG не найдены в ${dir}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const problems: Problem[] = [];

  for (const file of files) {
    const rel = relative(root, file);
    await page.goto(`file://${file}`);

    // Строку вызываем самовызывающимся выражением: так Playwright не гадает,
    // выражение это или функция с аргументом.
    const found = (await page.evaluate(`(${MEASURE_JS})(${SAFE_EDGE})`)) as {
      texts: number;
      problems: { kind: string; text: string; detail: string }[];
    };

    for (const p of found.problems) {
      problems.push({ file: rel, kind: p.kind as Problem["kind"], text: p.text, detail: p.detail });
    }
    const bad = found.problems.length;
    console.log(`${bad === 0 ? c.dim("✓") : c.bold("✗")} ${rel} ${c.dim(`— надписей: ${found.texts}`)}`);
  }

  await browser.close();

  console.log("");
  if (problems.length === 0) {
    log.ok(`Схемы в порядке: ${files.length} файлов, надписи внутри фигур и холста`);
    return;
  }
  for (const p of problems) {
    log.err(`${p.file}${p.text ? ` · «${p.text}»` : ""}: ${p.detail}`);
  }
  log.warn(`Проблем: ${problems.length}. Правьте текст или геометрию фигуры и запускайте снова.`);
  process.exitCode = 1;
}

main().catch((e) => {
  log.err(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
