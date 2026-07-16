import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary, CommandError } from "./lib/exec.js";
import { c, log, humanSize } from "./lib/log.js";

/**
 * CLI: фабрика AI-подкастов — двухголосый обзор-диалог по уроку через NotebookLM
 * Audio Overview (неофициальный CLI notebooklm-py, браузерная автоматизация Google).
 * Это ОТДЕЛЬНЫЙ формат от «аудиоверсии урока» (factory:audio — дорожка из видео):
 * подкаст обсуждает материал двумя ведущими, как разбор, а не озвучка лекции.
 *
 *   pnpm factory:podcast --lesson <lessonId>
 *   pnpm factory:podcast --course <courseSlug>          # батч всех уроков с контентом
 *   опции: --force (перезаписать podcastKey), --length short|default|long,
 *          --format deep-dive|brief|critique|debate (по умолчанию deep-dive)
 *
 * Источник для генерации — текст урока из БД: конспект (AiArtifact SUMMARY, VALIDATED)
 * либо, если его нет, очищенный транскрипт. Видео/ссылку НЕ подаём — больше контроля.
 * Язык подкаста — русский (NotebookLM не поддерживает kk/uz).
 *
 * Готовый m4a кладётся в storage: courses/<slug>/lessons/<id>/podcast.m4a и
 * раздаётся через /api/video/podcast/<lessonId> с проверкой доступа (как видео/аудио).
 *
 * Требует разовой авторизации NotebookLM: `notebooklm login --browser-cookies chrome`.
 * Cookie периодически протухают — это единственная ручная операция фичи.
 */

const LANGUAGE = "ru";

/** NotebookLM ограничивает число Audio Overview в день — отличаем от прочих сбоев. */
function isRateLimit(e: unknown): boolean {
  const text = e instanceof CommandError ? e.stderr : e instanceof Error ? e.message : String(e);
  return /rate.?limit|quota/i.test(text);
}

interface LessonContent {
  id: string;
  title: string;
  courseSlug: string;
  podcastKey: string | null;
  sourceText: string;
}

/** Загрузить урок и связный текст для подкаста: конспект → иначе транскрипт. */
async function loadLessonContent(lessonId: string): Promise<LessonContent | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      podcastKey: true,
      module: { select: { course: { select: { slug: true } } } },
      aiArtifacts: {
        where: { type: "SUMMARY", validation: "VALIDATED" },
        select: { content: true },
      },
      transcript: { select: { cleanText: true, status: true } },
    },
  });
  if (!lesson) throw new Error(`Урок ${lessonId} не найден`);

  const summary = lesson.aiArtifacts[0]?.content?.trim() || null;
  const cleanText =
    lesson.transcript?.status === "CLEANED" ? lesson.transcript.cleanText?.trim() || null : null;
  const sourceText = summary ?? cleanText;
  if (!sourceText) {
    log.warn(`Урок «${lesson.title}» без конспекта и транскрипта — нечего озвучивать, пропуск`);
    return null;
  }

  return {
    id: lesson.id,
    title: lesson.title,
    courseSlug: lesson.module.course.slug,
    podcastKey: lesson.podcastKey,
    sourceText,
  };
}

/**
 * Освежить авторизацию NotebookLM из cookie Chrome. Сессия Google в браузере живёт
 * и обновляется сама, а сохранённый storage_state протухает за минуты — поэтому
 * переимпортируем перед каждым уроком (операция дешёвая, неинтерактивная).
 */
async function reimportAuth(): Promise<void> {
  await run("notebooklm", ["login", "--browser-cookies", "chrome"]);
}

/** Извлечь id ноутбука из JSON-ответа CLI (`{id}` либо `{notebook:{id}}`). */
function extractId(stdout: string): string {
  const obj = JSON.parse(stdout) as { id?: string; notebook?: { id?: string } };
  const id = obj.id ?? obj.notebook?.id;
  if (!id) throw new Error(`Не удалось разобрать id ноутбука из ответа CLI: ${stdout.slice(0, 200)}`);
  return id;
}

/** Инструкция ведущим подкаста — задаёт тон и фокус под курс продаж. */
function buildPrompt(title: string): string {
  return (
    `Это обучающий подкаст по продажам для курса медицинских представителей. ` +
    `Тема урока: «${title}». Объясните материал живо и по делу, как разбор для новичка: ` +
    `ключевые приёмы, типичные ошибки и короткие примеры реплик из диалога с врачом. ` +
    `Говорите на русском, по-деловому, без воды.`
  );
}

async function generatePodcast(
  lesson: LessonContent,
  opts: { length: string; format: string },
  workDir: string,
): Promise<Buffer> {
  // 1. Ноутбук под урок.
  log.step("NotebookLM: создаю ноутбук");
  const created = await run("notebooklm", [
    "create",
    `ACTIVE SALES · ${lesson.title}`,
    "--json",
  ]);
  const notebookId = extractId(created.stdout);

  try {
    // 2. Источник — текст урока (inline, не файл: NotebookLM надёжнее принимает text).
    log.step("NotebookLM: добавляю источник (текст урока)");
    await run("notebooklm", [
      "source", "add", lesson.sourceText,
      "--type", "text",
      "--title", lesson.title,
      "-n", notebookId,
      "--json",
    ]);

    // 3. Генерация подкаста (ждём завершения; до 30 мин).
    log.step(`NotebookLM: генерирую подкаст (${opts.format}, ${opts.length}, ${LANGUAGE}) — это несколько минут`);
    const gen = await run("notebooklm", [
      "generate", "audio", buildPrompt(lesson.title),
      "-n", notebookId,
      "--format", opts.format,
      "--length", opts.length,
      "--language", LANGUAGE,
      "--wait",
      "--timeout", "1800",
      "--json",
    ]);
    const status = (JSON.parse(gen.stdout) as { status?: string }).status;
    if (status !== "completed") {
      throw new Error(`NotebookLM вернул статус «${status}», ожидался «completed»`);
    }

    // 4. Скачать (по факту m4a/AAC, несмотря на расширение).
    log.step("NotebookLM: скачиваю аудио");
    const outFile = join(workDir, "podcast.m4a");
    await run("notebooklm", ["download", "audio", outFile, "-n", notebookId]);
    return await readFile(outFile);
  } finally {
    // 5. Убираем ноутбук, чтобы не засорять аккаунт и не ломать повторные прогоны.
    try {
      await run("notebooklm", ["delete", "-n", notebookId, "-y"]);
    } catch (e) {
      log.warn(`Не удалось удалить ноутбук ${notebookId}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function processLesson(
  lessonId: string,
  opts: { force: boolean; length: string; format: string },
): Promise<{ sizeBytes: number } | null> {
  const lesson = await loadLessonContent(lessonId);
  if (!lesson) return null;

  if (lesson.podcastKey && !opts.force) {
    log.warn(`Урок «${lesson.title}» уже с подкастом — пропуск (--force для перезаписи)`);
    return null;
  }

  const key = `courses/${lesson.courseSlug}/lessons/${lesson.id}/podcast.m4a`;
  const workDir = await mkdtemp(join(tmpdir(), `salesup-podcast-${lesson.id}-`));

  try {
    await reimportAuth(); // освежить cookie — иначе на длинном батче авторизация протухает
    const data = await generatePodcast(lesson, opts, workDir);

    log.step(`Загружаю в хранилище: ${c.dim(key)}`);
    await storage.delete(key); // идемпотентность
    await storage.put(key, data);
    await db.lesson.update({ where: { id: lesson.id }, data: { podcastKey: key } });

    log.ok(`Подкаст урока «${lesson.title}» готов: ${humanSize(data.length)}`);
    return { sizeBytes: data.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = args.options.force === true;
  const length = typeof args.options.length === "string" ? args.options.length : "default";
  const format = typeof args.options.format === "string" ? args.options.format : "deep-dive";

  await requireBinary(
    "notebooklm",
    "Установите: uv tool install 'notebooklm-py[browser,cookies]', затем notebooklm login --browser-cookies chrome",
  );

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
    const failed: string[] = [];
    for (const [i, id] of ids.entries()) {
      console.log(`\n${c.bold(`[${i + 1}/${ids.length}]`)}`);
      try {
        const r = await processLesson(id, { force, length, format });
        if (r) {
          total += r.sizeBytes;
          processed++;
        }
      } catch (e) {
        // Дневная квота NotebookLM исчерпана — остальные уроки тоже упрутся, выходим.
        if (isRateLimit(e)) {
          log.err("NotebookLM: дневная квота на генерацию аудио исчерпана. Повторите через 1–24 ч (готовые пропустятся).");
          failed.push(id, ...ids.slice(i + 1));
          break;
        }
        // Изоляция: один сбойный урок (auth/таймаут NotebookLM) не валит весь батч.
        log.err(`Урок ${id}: ${e instanceof Error ? e.message : String(e)}`);
        failed.push(id);
      }
    }
    if (failed.length) {
      log.warn(`Не удалось: ${failed.length} — повторите для них (готовые пропустятся): ${failed.join(" ")}`);
    }
  } else if (lessonId) {
    const r = await processLesson(lessonId, { force, length, format });
    if (r) {
      total += r.sizeBytes;
      processed++;
    }
  } else {
    throw new Error("Укажите --lesson <id> или --course <slug>");
  }

  log.ok(`Готово: ${processed} подкастов, суммарно ${humanSize(total)}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
