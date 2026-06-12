import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { complete } from "@/lib/ai/anthropic";
import { CLEAN_TRANSCRIPT_SYSTEM, cleanTranscriptPrompt } from "@/lib/ai/prompts/clean-transcript";
import { parseVtt, cuesToRawText } from "@/lib/factory/vtt";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary } from "./lib/exec.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: транскрипты уроков из авто-субтитров YouTube (S3.1).
 *   pnpm factory:transcript --lesson <id>
 *   pnpm factory:transcript --course <slug>     # все уроки курса с youtubeUrl
 *   опции: --lang ru (по умолчанию) --force (перечитать готовый)
 *
 * Поток: yt-dlp скачивает авто-субтитры (VTT) → парсинг+дедуп → Haiku очищает
 * пунктуацию/абзацы (без выдумок) → Transcript(cleanText, status=CLEANED).
 * Эмбеддинги/чанки для RAG — отдельный шаг (S3.1 ext). Идемпотентно.
 */

async function fetchSubsVtt(url: string, lang: string): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), "salesup-subs-"));
  try {
    await run("yt-dlp", [
      "--write-auto-subs",
      "--sub-langs", lang,
      "--sub-format", "vtt",
      "--skip-download",
      "--no-playlist",
      "-o", join(dir, "sub"),
      url,
    ]);
    const files = await readdir(dir);
    const vttFile = files.find((f) => f.endsWith(".vtt"));
    if (!vttFile) return null;
    return readFile(join(dir, vttFile), "utf8");
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function processLesson(
  lesson: { id: string; title: string; youtubeUrl: string | null },
  opts: { lang: string; force: boolean },
): Promise<{ ok: boolean; chars: number }> {
  if (!lesson.youtubeUrl) {
    log.warn(`«${lesson.title}»: нет youtubeUrl — пропуск`);
    return { ok: false, chars: 0 };
  }

  const existing = await db.transcript.findUnique({
    where: { lessonId: lesson.id },
    select: { status: true },
  });
  if (existing && existing.status === "CLEANED" && !opts.force) {
    log.warn(`«${lesson.title}»: транскрипт уже готов — пропуск (--force для пересборки)`);
    return { ok: true, chars: 0 };
  }

  log.step(`Субтитры: ${c.dim(lesson.youtubeUrl)}`);
  const vtt = await fetchSubsVtt(lesson.youtubeUrl, opts.lang);
  if (!vtt) {
    log.err(`«${lesson.title}»: субтитры (${opts.lang}) недоступны`);
    await db.transcript.upsert({
      where: { lessonId: lesson.id },
      create: { lessonId: lesson.id, sourceUrl: lesson.youtubeUrl, language: opts.lang, status: "FAILED", error: "Нет субтитров" },
      update: { status: "FAILED", error: "Нет субтитров" },
    });
    return { ok: false, chars: 0 };
  }

  const rawText = cuesToRawText(parseVtt(vtt));
  log.info(`Сырой текст: ${rawText.length} символов`);

  log.step("Очистка через Haiku…");
  const cleanText = await complete({
    model: "claude-haiku-4-5",
    system: CLEAN_TRANSCRIPT_SYSTEM,
    prompt: cleanTranscriptPrompt(rawText),
    maxTokens: 4096,
    temperature: 0.2,
    operation: "transcript.clean",
  });

  await db.transcript.upsert({
    where: { lessonId: lesson.id },
    create: {
      lessonId: lesson.id,
      sourceUrl: lesson.youtubeUrl,
      language: opts.lang,
      rawText,
      cleanText,
      status: "CLEANED",
    },
    update: { rawText, cleanText, status: "CLEANED", error: null },
  });

  log.ok(`«${lesson.title}»: ${cleanText.length} символов`);
  return { ok: true, chars: cleanText.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const lang = typeof args.options.lang === "string" ? args.options.lang : "ru";
  const force = args.options.force === true;

  await requireBinary("yt-dlp", "Установите: brew install yt-dlp");

  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const lessonId = typeof args.options.lesson === "string" ? args.options.lesson : null;

  let lessons: { id: string; title: string; youtubeUrl: string | null }[] = [];
  if (courseSlug) {
    const course = await db.course.findUnique({
      where: { slug: courseSlug },
      select: { title: true, modules: { orderBy: { sortOrder: "asc" }, select: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, youtubeUrl: true } } } } },
    });
    if (!course) throw new Error(`Курс ${courseSlug} не найден`);
    lessons = course.modules.flatMap((m) => m.lessons);
    log.step(`Курс «${course.title}»: ${lessons.length} уроков`);
  } else if (lessonId) {
    const l = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, title: true, youtubeUrl: true } });
    if (!l) throw new Error(`Урок ${lessonId} не найден`);
    lessons = [l];
  } else {
    throw new Error("Укажите --lesson <id> или --course <slug>");
  }

  let ok = 0;
  let totalChars = 0;
  for (const [i, l] of lessons.entries()) {
    console.log(`\n${c.bold(`[${i + 1}/${lessons.length}]`)} ${l.title}`);
    const r = await processLesson(l, { lang, force });
    if (r.ok) ok++;
    totalChars += r.chars;
  }

  console.log(`\n${c.bold("── Отчёт ──")}`);
  log.info(`Транскриптов готово: ${ok}/${lessons.length}`);
  log.info(`Суммарно символов: ${totalChars}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
