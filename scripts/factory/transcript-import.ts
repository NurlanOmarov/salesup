import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: загрузка транскриптов курса из «Презентации/<Курс>/» в БД — зеркало
 * factory:transcript-export.
 *
 *   pnpm factory:transcript-import --course sales-realty --folder "Техники продаж недвижимости"
 *
 * Зачем: обычный путь транскрипта — factory:transcript (авто-субтитры YouTube +
 * очистка Haiku). Но у части роликов авто-субтитров нет вовсе, а текст, вычитанный
 * вручную, точнее машинной очистки. Такие транскрипты живут файлами рядом с уроком,
 * и этой командой попадают в Transcript.cleanText — иначе RAG и ИИ-наставник по
 * курсу работают вслепую.
 *
 * Что читает: <Презентации>/<folder>/<NN-имя>/transcript.txt, где NN — порядковый
 * номер урока в курсе. Первые две строки файла — служебная шапка экспорта
 * («Урок: …», «Курс: …») — отбрасываются. Существующие транскрипты не трогаются
 * без --force. Идемпотентно.
 */

const ROOT = join(process.cwd(), "Презентации");

/** Отбросить служебную шапку экспорта, если она есть. */
function stripHeader(text: string): string {
  const lines = text.split("\n");
  if (lines[0]?.startsWith("Урок: ") && lines[1]?.startsWith("Курс: ")) {
    return lines.slice(2).join("\n").trim();
  }
  return text.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = typeof args.options.course === "string" ? args.options.course : null;
  const folder = typeof args.options.folder === "string" ? args.options.folder : null;
  const force = Boolean(args.options.force);
  if (!slug || !folder) {
    throw new Error('Укажите --course <slug> и --folder "<папка в Презентации>"');
  }

  const course = await db.course.findUnique({ where: { slug }, select: { id: true } });
  if (!course) throw new Error(`Курс ${slug} не найден`);

  const lessons = await db.lesson.findMany({
    where: { module: { courseId: course.id } },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, title: true, youtubeUrl: true },
  });

  const base = join(ROOT, folder);
  const dirs = await readdir(base).catch(() => {
    throw new Error(`Папка не найдена: ${base}`);
  });

  let written = 0;
  let skipped = 0;
  for (const [i, lesson] of lessons.entries()) {
    const prefix = `${String(i + 1).padStart(2, "0")}-`;
    const dir = dirs.find((name) => name.startsWith(prefix));
    if (!dir) {
      log.warn(`«${lesson.title}»: папка ${prefix}* не найдена — пропуск`);
      skipped += 1;
      continue;
    }

    const raw = await readFile(join(base, dir, "transcript.txt"), "utf8").catch(() => null);
    if (!raw) {
      log.warn(`${dir}: нет transcript.txt — пропуск`);
      skipped += 1;
      continue;
    }
    const text = stripHeader(raw);
    if (!text) {
      log.warn(`${dir}: transcript.txt пуст — пропуск`);
      skipped += 1;
      continue;
    }

    const existing = await db.transcript.findUnique({
      where: { lessonId: lesson.id },
      select: { status: true },
    });
    if (existing && existing.status === "CLEANED" && !force) {
      log.info(`${dir}: транскрипт уже в БД — пропуск (--force для перезаписи)`);
      skipped += 1;
      continue;
    }

    await db.transcript.upsert({
      where: { lessonId: lesson.id },
      create: {
        lessonId: lesson.id,
        sourceUrl: lesson.youtubeUrl ?? "",
        language: "ru",
        cleanText: text,
        status: "CLEANED",
      },
      update: { cleanText: text, status: "CLEANED", error: null },
    });
    log.info(`${dir} → ${lesson.title} ${c.dim(`(${text.length} символов)`)}`);
    written += 1;
  }

  log.ok(`Загружено транскриптов: ${written}${skipped ? `, пропущено: ${skipped}` : ""}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
