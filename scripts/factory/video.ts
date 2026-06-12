import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { env } from "@/env";
import { storage } from "@/lib/storage";
import { encryptHlsKey, generateHlsKey } from "@/lib/video/keys";
import { parseArgs, requireOption } from "./lib/args.js";
import { run, requireBinary } from "./lib/exec.js";
import { c, log, humanSize, fmtDuration } from "./lib/log.js";
import {
  buildMasterPlaylist,
  dirSize,
  keyInfoContent,
  listFilesRecursive,
  probeDurationSec,
  probeHeight,
  randomIvHex,
  selectLadder,
  transcodeQuality,
} from "./lib/hls.js";

/**
 * CLI: видео-конвейер YouTube → HLS AES-128 → хранилище (CLAUDE.md S2.1).
 *   pnpm factory:video <videoUrl> --lesson <lessonId>
 *   pnpm factory:video --course <courseSlug>        # батч всех уроков с youtubeUrl
 *   опции: --segment <sec=6> --keep (не удалять out/) --force (перекодировать READY)
 *
 * Гарантии: на VPS нет нешифрованных mp4 (загружаются только HLS-сегменты);
 * AES-ключ хранится в БД зашифрованным app-секретом, в плейлисте — только URI
 * защищённого эндпоинта; повторный запуск идемпотентен (старый префикс очищается).
 */

const SEGMENT_DEFAULT = 6;
const GB = 1024 ** 3;

interface LessonRow {
  id: string;
  title: string;
  youtubeUrl: string | null;
  videoStatus: string;
  courseSlug: string;
}

async function loadLesson(lessonId: string): Promise<LessonRow> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      youtubeUrl: true,
      videoStatus: true,
      module: { select: { course: { select: { slug: true } } } },
    },
  });
  if (!lesson) throw new Error(`Урок ${lessonId} не найден`);
  return {
    id: lesson.id,
    title: lesson.title,
    youtubeUrl: lesson.youtubeUrl,
    videoStatus: lesson.videoStatus,
    courseSlug: lesson.module.course.slug,
  };
}

/** Скачать исходник YouTube в mp4 (yt-dlp). cookies — браузер для age-restricted. */
async function downloadSource(url: string, dest: string, cookies?: string): Promise<void> {
  await run(
    "yt-dlp",
    [
      ...(cookies ? ["--cookies-from-browser", cookies] : []),
      "-f", "bv*[height<=1080]+ba/b[height<=1080]/b",
      "--merge-output-format", "mp4",
      "--no-playlist",
      "-o", dest,
      url,
    ],
    { onStderr: (line) => { if (/\[download\]\s+\d+\.\d+%/.test(line)) process.stdout.write(`\r  ${c.dim(line.trim())}`); } },
  );
  process.stdout.write("\n");
}

/** Залить каталог HLS в storage под префиксом, исключая ключ/служебные файлы. */
async function uploadHls(localDir: string, prefix: string): Promise<void> {
  // Идемпотентность: убрать прежние артефакты этого префикса.
  const existing = await storage.list(prefix);
  for (const key of existing) await storage.delete(key);

  const files = await listFilesRecursive(localDir);
  for (const rel of files) {
    if (rel === "key.bin" || rel === "key_info.txt") continue; // секреты не выгружаем
    const data = await readFile(join(localDir, rel));
    await storage.put(`${prefix}/${rel}`, data);
  }
}

async function processLesson(
  lesson: LessonRow,
  opts: { url: string; segmentSec: number; keep: boolean; force: boolean; cookies?: string },
): Promise<{ sizeBytes: number; durationSec: number; qualities: string[] }> {
  if (lesson.videoStatus === "READY" && !opts.force) {
    log.warn(`Урок «${lesson.title}» уже READY — пропуск (--force для перекодирования)`);
    return { sizeBytes: 0, durationSec: 0, qualities: [] };
  }

  const keyPrefix = `courses/${lesson.courseSlug}/lessons/${lesson.id}`;
  const workDir = await mkdtemp(join(tmpdir(), `salesup-video-${lesson.id}-`));
  const outDir = join(workDir, "out");
  await mkdir(outDir, { recursive: true });

  try {
    // 1. Скачать исходник
    log.step(`Скачиваю исходник: ${c.dim(opts.url)}`);
    const source = join(workDir, "source.mp4");
    await downloadSource(opts.url, source, opts.cookies);

    // 2. Зондировать
    const [height, durationSec] = await Promise.all([
      probeHeight(source),
      probeDurationSec(source),
    ]);
    const qualities = selectLadder(height);
    log.info(`Источник ${height}p · ${fmtDuration(durationSec)} → качества: ${qualities.map((q) => q.name).join(", ")}`);

    // 3. AES-128 ключ: файл для ffmpeg + зашифрованное значение для БД
    const aesKey = generateHlsKey();
    const keyPath = join(outDir, "key.bin");
    await writeFile(keyPath, aesKey);
    const keyInfoPath = join(outDir, "key_info.txt");
    await writeFile(
      keyInfoPath,
      keyInfoContent(`/api/video/key/${lesson.id}`, keyPath, randomIvHex()),
    );
    const videoAesKeyEnc = encryptHlsKey(aesKey, env.VIDEO_KEY_ENC_SECRET);

    // 4. Транскодировать каждое качество
    for (const q of qualities) {
      log.step(`Кодирую ${c.bold(q.name)} (AES-128, сегменты ${opts.segmentSec}с)…`);
      await transcodeQuality({
        input: source,
        outDir,
        quality: q,
        keyInfoPath,
        segmentSec: opts.segmentSec,
        onProgress: (line) => {
          const t = line.match(/time=(\d+:\d+:\d+\.\d+)/);
          if (t) process.stdout.write(`\r  ${c.dim(`time=${t[1]}`)}`);
        },
      });
      process.stdout.write("\n");
    }

    // 5. master.m3u8
    await writeFile(join(outDir, "master.m3u8"), buildMasterPlaylist(qualities));

    // 6. Размер до загрузки (без ключа)
    const sizeBytes = (await dirSize(outDir)) - aesKey.length;

    // 7. Загрузка в storage (ключ исключён)
    log.step(`Загружаю в хранилище: ${c.dim(keyPrefix)}`);
    await uploadHls(outDir, keyPrefix);

    // 8. Обновить БД
    await db.lesson.update({
      where: { id: lesson.id },
      data: {
        videoKey: keyPrefix,
        videoAesKeyEnc,
        videoStatus: "READY",
        durationSec,
        youtubeUrl: opts.url,
      },
    });

    log.ok(`Урок «${lesson.title}» готов: ${humanSize(sizeBytes)}, ${fmtDuration(durationSec)}`);
    return { sizeBytes, durationSec, qualities: qualities.map((q) => q.name) };
  } finally {
    if (opts.keep) log.info(`Артефакты сохранены: ${workDir}`);
    else await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const segmentSec = Number(args.options.segment ?? SEGMENT_DEFAULT);
  const keep = args.options.keep === true;
  const force = args.options.force === true;
  const cookies = typeof args.options.cookies === "string" ? args.options.cookies : undefined;

  await requireBinary("yt-dlp", "Установите: brew install yt-dlp");
  await requireBinary("ffmpeg", "Установите: brew install ffmpeg");

  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;

  let totalBytes = 0;
  let totalSec = 0;
  let processed = 0;
  const failed: { title: string; error: string }[] = [];

  if (courseSlug) {
    // Батч: все уроки курса с youtubeUrl
    const course = await db.course.findUnique({
      where: { slug: courseSlug },
      select: {
        title: true,
        modules: {
          orderBy: { sortOrder: "asc" },
          select: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, title: true, youtubeUrl: true, videoStatus: true },
            },
          },
        },
      },
    });
    if (!course) throw new Error(`Курс ${courseSlug} не найден`);

    const lessons = course.modules.flatMap((m) => m.lessons).filter((l) => l.youtubeUrl);
    log.step(`Курс «${course.title}»: ${lessons.length} уроков с видео`);

    for (const [i, l] of lessons.entries()) {
      console.log(`\n${c.bold(`[${i + 1}/${lessons.length}]`)} ${l.title}`);
      try {
        const lesson = await loadLesson(l.id);
        const r = await processLesson(lesson, { url: l.youtubeUrl!, segmentSec, keep, force, cookies });
        totalBytes += r.sizeBytes;
        totalSec += r.durationSec;
        if (r.qualities.length) processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.err(`«${l.title}»: ${msg}`);
        failed.push({ title: l.title, error: msg });
      }
    }
  } else {
    // Один урок
    const lessonId = requireOption(args, "lesson", "factory:video <url> --lesson <id>");
    const url = args.positionals[0];
    if (!url) throw new Error("Не задан URL видео (первый позиционный аргумент)");
    const lesson = await loadLesson(lessonId);
    const r = await processLesson(lesson, { url, segmentSec, keep, force, cookies });
    totalBytes += r.sizeBytes;
    totalSec += r.durationSec;
    if (r.qualities.length) processed++;
  }

  // ── Отчёт ───────────────────────────────────────────────────────────────
  console.log(`\n${c.bold("── Отчёт ──")}`);
  log.info(`Обработано уроков: ${processed}`);
  log.info(`Суммарный размер HLS: ${humanSize(totalBytes)}`);
  log.info(`Суммарная длительность: ${fmtDuration(totalSec)}`);
  if (totalSec > 0) {
    const gbPerHour = (totalBytes / GB) / (totalSec / 3600);
    log.info(`Прогноз занятости диска: ~${gbPerHour.toFixed(2)} ГБ/час видео`);
  }
  if (failed.length) {
    log.warn(`Ошибки (${failed.length}):`);
    for (const f of failed) log.err(`  ${f.title}: ${f.error}`);
  }

  await db.$disconnect();
  if (failed.length) process.exit(1);
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
