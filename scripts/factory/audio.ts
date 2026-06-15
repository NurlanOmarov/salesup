import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary } from "./lib/exec.js";
import { c, log, humanSize } from "./lib/log.js";

/**
 * CLI: подкаст-конвейер — извлечение аудиодорожки из видео урока (CLAUDE.md, формат
 * «подкаст»). Источник тот же, что у видео (yt-dlp по youtubeUrl), извлекается чистое
 * аудио (m4a/AAC) и кладётся в storage рядом с HLS: courses/<slug>/lessons/<id>/audio.m4a.
 *
 *   pnpm factory:audio --lesson <lessonId>
 *   pnpm factory:audio --course <courseSlug>     # батч всех уроков с youtubeUrl
 *   опции: --force (перезаписать существующий audioKey), --cookies <browser>
 *
 * Аудио — тот же платный контент: раздаётся через /api/video/audio/<lessonId> с
 * проверкой доступа (canAccessLesson), на VPS — nginx X-Accel-Redirect.
 */

interface LessonRow {
  id: string;
  title: string;
  youtubeUrl: string | null;
  audioKey: string | null;
  courseSlug: string;
}

async function loadLesson(lessonId: string): Promise<LessonRow> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      youtubeUrl: true,
      audioKey: true,
      module: { select: { course: { select: { slug: true } } } },
    },
  });
  if (!lesson) throw new Error(`Урок ${lessonId} не найден`);
  return {
    id: lesson.id,
    title: lesson.title,
    youtubeUrl: lesson.youtubeUrl,
    audioKey: lesson.audioKey,
    courseSlug: lesson.module.course.slug,
  };
}

/** Скачать только аудио источника и привести к m4a (AAC) одним проходом yt-dlp+ffmpeg. */
async function extractAudio(url: string, dest: string, cookies?: string): Promise<void> {
  await run(
    "yt-dlp",
    [
      ...(cookies ? ["--cookies-from-browser", cookies] : []),
      "-f", "ba/bestaudio/best",
      "--no-playlist",
      "-x", // извлечь аудио
      "--audio-format", "m4a",
      "--audio-quality", "1",
      "-o", dest,
      url,
    ],
    { onStderr: (line) => { if (/\[download\]\s+\d+\.\d+%/.test(line)) process.stdout.write(`\r  ${c.dim(line.trim())}`); } },
  );
  process.stdout.write("\n");
}

async function processLesson(
  lesson: LessonRow,
  opts: { force: boolean; cookies?: string },
): Promise<{ sizeBytes: number } | null> {
  if (!lesson.youtubeUrl) {
    log.warn(`Урок «${lesson.title}» без youtubeUrl — пропуск`);
    return null;
  }
  if (lesson.audioKey && !opts.force) {
    log.warn(`Урок «${lesson.title}» уже с аудио — пропуск (--force для перезаписи)`);
    return null;
  }

  const key = `courses/${lesson.courseSlug}/lessons/${lesson.id}/audio.m4a`;
  const workDir = await mkdtemp(join(tmpdir(), `salesup-audio-${lesson.id}-`));
  // yt-dlp с -x подставляет расширение сам; задаём шаблон без него.
  const outTemplate = join(workDir, "audio.%(ext)s");

  try {
    log.step(`Извлекаю аудио: ${c.dim(lesson.youtubeUrl)}`);
    await extractAudio(lesson.youtubeUrl, outTemplate, opts.cookies);

    const data = await readFile(join(workDir, "audio.m4a"));
    log.step(`Загружаю в хранилище: ${c.dim(key)}`);
    await storage.delete(key); // идемпотентность
    await storage.put(key, data);

    await db.lesson.update({ where: { id: lesson.id }, data: { audioKey: key } });

    log.ok(`Подкаст урока «${lesson.title}» готов: ${humanSize(data.length)}`);
    return { sizeBytes: data.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = args.options.force === true;
  const cookies = typeof args.options.cookies === "string" ? args.options.cookies : undefined;

  await requireBinary("yt-dlp", "Установите: brew install yt-dlp");
  await requireBinary("ffmpeg", "Установите: brew install ffmpeg");

  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const lessonId = typeof args.options.lesson === "string" ? args.options.lesson : null;

  let total = 0;
  let processed = 0;

  if (courseSlug) {
    const course = await db.course.findUnique({
      where: { slug: courseSlug },
      select: {
        title: true,
        modules: {
          orderBy: { sortOrder: "asc" },
          select: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true } } },
        },
      },
    });
    if (!course) throw new Error(`Курс ${courseSlug} не найден`);
    const ids = course.modules.flatMap((m) => m.lessons).map((l) => l.id);
    log.step(`Курс «${course.title}»: ${ids.length} уроков`);
    for (const [i, id] of ids.entries()) {
      const lesson = await loadLesson(id);
      console.log(`\n${c.bold(`[${i + 1}/${ids.length}]`)} ${lesson.title}`);
      const r = await processLesson(lesson, { force, cookies });
      if (r) {
        total += r.sizeBytes;
        processed++;
      }
    }
  } else if (lessonId) {
    const lesson = await loadLesson(lessonId);
    const r = await processLesson(lesson, { force, cookies });
    if (r) {
      total += r.sizeBytes;
      processed++;
    }
  } else {
    throw new Error("Укажите --lesson <id> или --course <slug>");
  }

  log.ok(`Готово: ${processed} аудио, суммарно ${humanSize(total)}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
