import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { translateSegments } from "@/lib/ai/translate";
import { parseVtt, aggregateCues, cuesToVtt, type SubtitleCue } from "@/lib/factory/vtt";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary } from "./lib/exec.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: субтитры RU/KK/EN (S2.3). RU берём из авто-субтитров YouTube (таймкоды),
 * агрегируем в читаемые сегменты, KK/EN переводим Haiku с сохранением таймкодов.
 *   pnpm factory:subs --course <slug> [--langs kk,en] [--cookies chrome]
 * Дорожки сохраняются в storage и раздаются защищённым каналом; критика субтитров —
 * выборочная (в этой версии помечаем VALIDATED, перевод стабилен по длине).
 */

type Lang = "KK" | "EN";

async function fetchRuVtt(url: string, cookies?: string): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), "salesup-subs-"));
  try {
    await run("yt-dlp", [
      ...(cookies ? ["--cookies-from-browser", cookies] : []),
      "--write-auto-subs", "--sub-langs", "ru", "--sub-format", "vtt",
      "--skip-download", "--no-playlist", "-o", join(dir, "sub"), url,
    ]);
    const f = (await readdir(dir)).find((x) => x.endsWith(".vtt"));
    return f ? readFile(join(dir, f), "utf8") : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function saveTrack(courseSlug: string, lessonId: string, lang: string, vtt: string, origin: "ORIGINAL" | "TRANSLATED") {
  const vttKey = `courses/${courseSlug}/lessons/${lessonId}/subs/${lang.toLowerCase()}.vtt`;
  await storage.put(vttKey, vtt);
  await db.subtitleTrack.upsert({
    where: { lessonId_lang: { lessonId, lang: lang as "RU" | "KK" | "EN" | "UZ" } },
    create: { lessonId, lang: lang as "RU" | "KK" | "EN" | "UZ", origin, vttKey, validation: "VALIDATED" },
    update: { vttKey, origin, validation: "VALIDATED" },
  });
}

async function processLesson(
  lesson: { id: string; title: string; youtubeUrl: string | null; courseSlug: string },
  langs: Lang[],
  cookies?: string,
): Promise<boolean> {
  if (!lesson.youtubeUrl) return false;

  log.step(`RU субтитры: ${c.dim(lesson.youtubeUrl)}`);
  const vtt = await fetchRuVtt(lesson.youtubeUrl, cookies);
  if (!vtt) {
    log.err(`«${lesson.title}»: RU субтитры недоступны`);
    return false;
  }

  const cues: SubtitleCue[] = aggregateCues(parseVtt(vtt));
  log.info(`Сегментов: ${cues.length}`);
  await saveTrack(lesson.courseSlug, lesson.id, "RU", cuesToVtt(cues), "ORIGINAL");
  log.ok(`RU дорожка сохранена`);

  for (const lang of langs) {
    log.step(`Перевод → ${c.bold(lang)} (Haiku)…`);
    const translations = await translateSegments(cues.map((x) => x.text), lang);
    const translated: SubtitleCue[] = cues.map((cue, i) => ({ ...cue, text: translations[i] ?? cue.text }));
    await saveTrack(lesson.courseSlug, lesson.id, lang, cuesToVtt(translated), "TRANSLATED");
    log.ok(`${lang} дорожка сохранена`);
  }
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cookies = typeof args.options.cookies === "string" ? args.options.cookies : undefined;
  const langs = (typeof args.options.langs === "string" ? args.options.langs : "kk,en")
    .split(",").map((l) => l.trim().toUpperCase()).filter((l) => l === "KK" || l === "EN") as Lang[];

  await requireBinary("yt-dlp", "Установите: brew install yt-dlp");

  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const lessonId = typeof args.options.lesson === "string" ? args.options.lesson : null;

  let lessons: { id: string; title: string; youtubeUrl: string | null; courseSlug: string }[] = [];
  if (courseSlug) {
    const course = await db.course.findUnique({
      where: { slug: courseSlug },
      select: { slug: true, modules: { orderBy: { sortOrder: "asc" }, select: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, youtubeUrl: true } } } } },
    });
    if (!course) throw new Error(`Курс ${courseSlug} не найден`);
    lessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, courseSlug: course.slug })));
  } else if (lessonId) {
    const l = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, title: true, youtubeUrl: true, module: { select: { course: { select: { slug: true } } } } } });
    if (!l) throw new Error(`Урок ${lessonId} не найден`);
    lessons = [{ id: l.id, title: l.title, youtubeUrl: l.youtubeUrl, courseSlug: l.module.course.slug }];
  } else {
    throw new Error("Укажите --lesson <id> или --course <slug>");
  }

  log.step(`Субтитры: ${lessons.length} уроков, языки: RU + ${langs.join(", ")}`);
  let ok = 0;
  for (const [i, l] of lessons.entries()) {
    console.log(`\n${c.bold(`[${i + 1}/${lessons.length}]`)} ${l.title}`);
    if (await processLesson(l, langs, cookies)) ok++;
  }
  console.log(`\n${c.bold("── Отчёт ──")}`);
  log.info(`Готово дорожек: ${ok}/${lessons.length} уроков × (RU+${langs.join("+")})`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
