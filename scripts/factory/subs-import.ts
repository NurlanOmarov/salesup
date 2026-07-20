import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";
import { parseVtt } from "@/lib/factory/vtt";

/**
 * CLI: импорт ГОТОВЫХ переведённых дорожек субтитров (KK/EN/UZ) в курс.
 *
 * Дополняет factory:subs: тот берёт RU из авто-субтитров YouTube, а перевод по
 * решению владельца делает оператор в Claude Code, а не Haiku (см. комментарий
 * в subs.ts). Этой команде отдают готовые .vtt — она проверяет их и кладёт в
 * storage + SubtitleTrack.
 *
 *   pnpm factory:subs-import --dir <каталог> --course sales-b2b [--dry-run]
 *
 * Структура каталога: файлы вида `<lessonId>.<lang>.vtt`, напр.
 * `cmrt1l5wg000g9kgdpg0lsrg7.kk.vtt` — id урока берётся из ключа RU-дорожки
 * (courses/<slug>/lessons/<id>/subs/ru.vtt).
 *
 * Проверки перед записью (перевод не должен разъехаться с видео):
 *   • урок существует и принадлежит указанному курсу;
 *   • число реплик совпадает с RU-дорожкой;
 *   • таймкоды совпадают с RU-дорожкой (сравниваем начало каждой реплики).
 * Любое расхождение — отказ по этому файлу, остальные импортируются.
 *
 * Ключ хранилища: courses/<slug>/lessons/<id>/subs/<lang>.vtt
 * origin=TRANSLATED, validation=VALIDATED (перевод сделан и вычитан оператором).
 */

const LANGS = ["KK", "EN", "UZ"] as const;
type Lang = (typeof LANGS)[number];

function parseName(file: string): { lessonId: string; lang: Lang } | null {
  const m = /^([a-z0-9]+)\.(kk|en|uz)\.vtt$/i.exec(basename(file));
  if (!m) return null;
  return { lessonId: m[1]!, lang: m[2]!.toUpperCase() as Lang };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = typeof args.options.dir === "string" ? args.options.dir : null;
  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const dryRun = args.options["dry-run"] === true;
  if (!dir || !courseSlug) throw new Error("Укажите --dir <каталог> и --course <slug>");

  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".vtt"));
  const jobs = files.map((f) => ({ file: f, meta: parseName(f) })).filter((j) => j.meta !== null);
  const skipped = files.length - jobs.length;
  if (skipped > 0) log.info(`Пропущено файлов с неподходящим именем: ${skipped} (нужно <lessonId>.<lang>.vtt)`);
  if (jobs.length === 0) throw new Error(`В каталоге нет файлов вида <lessonId>.<lang>.vtt: ${dir}`);

  let done = 0;
  let failed = 0;
  for (const [i, job] of jobs.entries()) {
    const { lessonId, lang } = job.meta!;
    log.step(`[${i + 1}/${jobs.length}] ${c.bold(lang)} ← ${c.dim(job.file)}`);

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, title: true, module: { select: { course: { select: { slug: true } } } } },
    });
    if (!lesson) {
      log.err(`Урок ${lessonId} не найден`);
      failed++;
      continue;
    }
    if (lesson.module.course.slug !== courseSlug) {
      log.err(`Урок «${lesson.title}» принадлежит курсу ${lesson.module.course.slug}, а не ${courseSlug}`);
      failed++;
      continue;
    }

    const ruTrack = await db.subtitleTrack.findUnique({
      where: { lessonId_lang: { lessonId, lang: "RU" } },
      select: { vttKey: true },
    });
    if (!ruTrack) {
      log.err(`У урока «${lesson.title}» нет RU-дорожки — сначала pnpm factory:subs`);
      failed++;
      continue;
    }

    const vtt = await readFile(join(dir, job.file), "utf8");
    const cues = parseVtt(vtt);
    const ruCues = parseVtt((await storage.get(ruTrack.vttKey)).toString("utf8"));
    if (cues.length !== ruCues.length) {
      log.err(`Реплик ${cues.length}, а в RU-дорожке ${ruCues.length} — перевод разъехался с видео`);
      failed++;
      continue;
    }
    const shifted = cues.findIndex((cue, idx) => Math.abs(cue.startSec - ruCues[idx]!.startSec) > 0.05);
    if (shifted >= 0) {
      log.err(`Таймкод реплики №${shifted + 1} не совпадает с RU-дорожкой (${cues[shifted]!.startSec}с ≠ ${ruCues[shifted]!.startSec}с)`);
      failed++;
      continue;
    }

    const key = `courses/${courseSlug}/lessons/${lessonId}/subs/${lang.toLowerCase()}.vtt`;
    if (dryRun) {
      log.info(`[dry-run] ${key} — ${cues.length} реплик`);
      done++;
      continue;
    }

    await storage.put(key, Buffer.from(vtt, "utf8"));
    await db.subtitleTrack.upsert({
      where: { lessonId_lang: { lessonId, lang } },
      create: { lessonId, lang, vttKey: key, origin: "TRANSLATED", validation: "VALIDATED" },
      update: { vttKey: key, origin: "TRANSLATED", validation: "VALIDATED" },
    });
    log.ok(`«${lesson.title}» → ${lang}: ${cues.length} реплик`);
    done++;
  }

  console.log("\n── Отчёт ──");
  log.info(`Дорожек импортировано: ${done}${failed > 0 ? `, с ошибкой: ${failed}` : ""}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    log.err(String(e instanceof Error ? e.message : e));
    await db.$disconnect();
    process.exit(1);
  });
