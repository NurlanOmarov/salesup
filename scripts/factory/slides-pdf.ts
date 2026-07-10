import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary, CommandError } from "./lib/exec.js";
import { c, log, humanSize } from "./lib/log.js";

/**
 * CLI: фабрика AI-презентаций — дизайнерская колода-слайды по уроку через
 * NotebookLM Slide Deck (неофициальный CLI notebooklm-py, браузерная автоматизация
 * Google). Это ДОПОЛНИТЕЛЬНЫЙ материал рядом с типизированной колодой SLIDES
 * (AiArtifact, свой просмотрщик <SlideDeck>): NotebookLM отдаёт готовую вёрстку с
 * иллюстрациями, но только как PDF/PPTX (данные из неё не извлечь), поэтому колода
 * подключается кнопкой «Скачать презентацию (PDF)», а не заменяет интерактивную.
 *
 *   pnpm factory:slides-pdf --lesson <lessonId>
 *   pnpm factory:slides-pdf --course <courseSlug>       # батч всех уроков с контентом
 *   опции: --force (перезаписать slidesPdfKey), --length default|short,
 *          --format detailed|presenter (по умолчанию detailed)
 *
 * Источник для генерации — текст урока из БД: конспект (AiArtifact SUMMARY,
 * VALIDATED) либо, если его нет, очищенный транскрипт. Язык — русский.
 *
 * ⚠️ NotebookLM обогащает контент выдуманной спецификой (примеры реплик, свойства
 * препаратов) — это дизайнерский черновик, а НЕ провалидированный критиком артефакт.
 * Поэтому PDF — доп. материал, который владелец просматривает перед публикацией урока
 * (см. CLAUDE.md, правила 4/5: без галлюцинаций, без публикации без критика).
 *
 * Готовый pdf кладётся в storage: courses/<slug>/lessons/<id>/slides.pdf и
 * раздаётся через /api/learn/slides-pdf/<lessonId> с проверкой доступа (как подкаст).
 *
 * Требует разовой авторизации NotebookLM: `notebooklm login --browser-cookies chrome`.
 * Cookie периодически протухают — это единственная ручная операция фичи.
 */

const LANGUAGE = "ru";

/** NotebookLM ограничивает число генераций Studio в день — отличаем от прочих сбоев. */
function isRateLimit(e: unknown): boolean {
  const text = e instanceof CommandError ? e.stderr : e instanceof Error ? e.message : String(e);
  return /rate.?limit|quota/i.test(text);
}

interface LessonContent {
  id: string;
  title: string;
  courseSlug: string;
  slidesPdfKey: string | null;
  sourceText: string;
}

/** Загрузить урок и связный текст для презентации: конспект → иначе транскрипт. */
async function loadLessonContent(lessonId: string): Promise<LessonContent | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      slidesPdfKey: true,
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
    log.warn(`Урок «${lesson.title}» без конспекта и транскрипта — нечего оформлять, пропуск`);
    return null;
  }

  return {
    id: lesson.id,
    title: lesson.title,
    courseSlug: lesson.module.course.slug,
    slidesPdfKey: lesson.slidesPdfKey,
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

/** Извлечь id из JSON-ответа CLI (`{id}` либо `{notebook:{id}}`). */
function extractId(stdout: string): string {
  const obj = JSON.parse(stdout) as { id?: string; notebook?: { id?: string } };
  const id = obj.id ?? obj.notebook?.id;
  if (!id) throw new Error(`Не удалось разобрать id из ответа CLI: ${stdout.slice(0, 200)}`);
  return id;
}

/** Инструкция для колоды — задаёт тон и фокус под курс продаж. */
function buildPrompt(title: string): string {
  return (
    `Обучающая презентация по продажам для курса медицинских представителей. ` +
    `Тема урока: «${title}». Оформи материал структурно и по делу: ключевые приёмы, ` +
    `типичные ошибки, короткие примеры реплик из диалога с врачом. ` +
    `Язык — русский, деловой тон, без воды.`
  );
}

/** Найти артефакт типа slide_deck в ноутбуке (для ретрая после сбоя генерации). */
async function findSlideDeckArtifact(notebookId: string): Promise<{ id: string; status: string } | null> {
  const res = await run("notebooklm", ["artifact", "list", "-n", notebookId, "--json"]);
  const obj = JSON.parse(res.stdout) as {
    artifacts?: { id: string; type_id?: string; status?: string }[];
  };
  const art = obj.artifacts?.find((a) => a.type_id === "slide_deck");
  return art ? { id: art.id, status: art.status ?? "" } : null;
}

async function generateSlidesPdf(
  lesson: LessonContent,
  opts: { length: string; format: string },
  workDir: string,
): Promise<Buffer> {
  // 1. Ноутбук под урок.
  log.step("NotebookLM: создаю ноутбук");
  const created = await run("notebooklm", ["create", `SalesUp · ${lesson.title}`, "--json"]);
  const notebookId = extractId(created.stdout);

  try {
    // 2. Источник — текст урока (inline text: NotebookLM надёжнее принимает text).
    log.step("NotebookLM: добавляю источник (текст урока)");
    await run("notebooklm", [
      "source", "add", lesson.sourceText,
      "--type", "text",
      "--title", lesson.title,
      "-n", notebookId,
      "--json",
    ]);

    // 3. Генерация колоды (ждём завершения). Первый прогон у NotebookLM иногда падает
    //    транзиентно (GENERATION_FAILED) — тогда находим артефакт и ретраим на месте.
    log.step(`NotebookLM: генерирую презентацию (${opts.format}, ${opts.length}, ${LANGUAGE}) — это несколько минут`);
    let ok = false;
    try {
      const gen = await run("notebooklm", [
        "generate", "slide-deck", buildPrompt(lesson.title),
        "-n", notebookId,
        "--format", opts.format,
        "--length", opts.length,
        "--language", LANGUAGE,
        "--wait",
        "--timeout", "900",
        "--json",
      ]);
      ok = (JSON.parse(gen.stdout) as { status?: string }).status === "completed";
    } catch (e) {
      if (isRateLimit(e)) throw e;
      log.warn("Первый прогон генерации не удался — пробую ретрай артефакта");
    }

    if (!ok) {
      // До 2 ретраев провалившегося артефакта (транзиентные сбои Studio).
      const art = await findSlideDeckArtifact(notebookId);
      if (!art) throw new Error("NotebookLM: артефакт презентации не создан");
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        log.step(`NotebookLM: ретрай генерации (${attempt}/2)`);
        await run("notebooklm", ["artifact", "retry", art.id, "-n", notebookId, "--json"]);
        const waited = await run("notebooklm", [
          "artifact", "wait", art.id, "-n", notebookId, "--timeout", "900", "--json",
        ]);
        ok = (JSON.parse(waited.stdout) as { status?: string }).status === "completed";
      }
      if (!ok) throw new Error("NotebookLM: презентация не сгенерирована (после ретраев)");
    }

    // 4. Скачать как PDF.
    log.step("NotebookLM: скачиваю PDF");
    const outFile = join(workDir, "slides.pdf");
    await run("notebooklm", [
      "download", "slide-deck", outFile, "-n", notebookId, "--format", "pdf", "--force",
    ]);
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

  if (lesson.slidesPdfKey && !opts.force) {
    log.warn(`Урок «${lesson.title}» уже с презентацией — пропуск (--force для перезаписи)`);
    return null;
  }

  const key = `courses/${lesson.courseSlug}/lessons/${lesson.id}/slides.pdf`;
  const workDir = await mkdtemp(join(tmpdir(), `salesup-slides-${lesson.id}-`));

  try {
    await reimportAuth(); // освежить cookie — иначе на длинном батче авторизация протухает
    const data = await generateSlidesPdf(lesson, opts, workDir);

    log.step(`Загружаю в хранилище: ${c.dim(key)}`);
    await storage.delete(key); // идемпотентность
    await storage.put(key, data);
    await db.lesson.update({ where: { id: lesson.id }, data: { slidesPdfKey: key } });

    log.ok(`Презентация урока «${lesson.title}» готова: ${humanSize(data.length)}`);
    return { sizeBytes: data.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = args.options.force === true;
  const length = typeof args.options.length === "string" ? args.options.length : "default";
  const format = typeof args.options.format === "string" ? args.options.format : "detailed";

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
          log.err("NotebookLM: дневная квота на генерацию исчерпана. Повторите через 1–24 ч (готовые пропустятся).");
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

  log.ok(`Готово: ${processed} презентаций, суммарно ${humanSize(total)}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
