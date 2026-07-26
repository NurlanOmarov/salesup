import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: выгрузка очищенных транскриптов курса в папку «Презентации/<Курс>/».
 *
 *   pnpm factory:transcript-export --course sales-kitchens --folder "Кухни 2.0"
 *
 * Зачем: транскрипты (Transcript.cleanText) живут в БД и нужны RAG, но для работы
 * над курсом — заданиями, раздатками, ревизией формулировок — их удобно держать
 * рядом с материалами урока в виде файлов, как у остальных курсов.
 *
 * Куда пишет: <Презентации>/<folder>/<NN-имя>/transcript.txt. Если подпапка урока
 * уже существует (её создаёт factory:handout), файл кладётся в неё; иначе папка
 * создаётся по номеру и названию урока. Существующие transcript.txt перезаписываются
 * только с флагом --force.
 */

const ROOT = join(process.cwd(), "Презентации");

/** Имя подпапки: «NN-Короткое название» без запрещённых в путях символов. */
function folderName(index: number, title: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${String(index).padStart(2, "0")}-${clean}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = typeof args.options.course === "string" ? args.options.course : null;
  const folder = typeof args.options.folder === "string" ? args.options.folder : null;
  const force = Boolean(args.options.force);
  if (!slug || !folder) {
    throw new Error('Укажите --course <slug> и --folder "<папка в Презентации>"');
  }

  const course = await db.course.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!course) throw new Error(`Курс ${slug} не найден`);

  const lessons = await db.lesson.findMany({
    where: { module: { courseId: course.id } },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      module: { select: { title: true } },
      transcript: { select: { cleanText: true, status: true } },
    },
  });

  const base = join(ROOT, folder);
  await mkdir(base, { recursive: true });
  const existing = await readdir(base).catch(() => [] as string[]);

  let written = 0;
  let skipped = 0;
  for (const [i, lesson] of lessons.entries()) {
    const num = i + 1;
    const text = lesson.transcript?.cleanText;
    if (!text || lesson.transcript?.status !== "CLEANED") {
      log.warn(`«${lesson.title}»: нет очищенного транскрипта — пропуск`);
      skipped += 1;
      continue;
    }

    // Подпапка урока: та, что уже есть с этим номером (её создаёт factory:handout), иначе новая.
    const prefix = `${String(num).padStart(2, "0")}-`;
    const dir = existing.find((name) => name.startsWith(prefix)) ?? folderName(num, lesson.title);
    const target = join(base, dir);
    await mkdir(target, { recursive: true });

    const file = join(target, "transcript.txt");
    const header = `Урок: ${lesson.title}\nКурс: ${course.title} (${slug}) | Модуль: ${lesson.module.title}\n\n`;
    if (!force) {
      const files = await readdir(target).catch(() => [] as string[]);
      if (files.includes("transcript.txt")) {
        log.info(`${dir}: transcript.txt уже есть — пропуск (--force для перезаписи)`);
        skipped += 1;
        continue;
      }
    }
    await writeFile(file, header + text.trim() + "\n", "utf8");
    log.info(`${dir}/transcript.txt — ${text.length} символов`);
    written += 1;
  }

  log.ok(`Выгружено транскриптов: ${written}${skipped ? `, пропущено: ${skipped}` : ""} ${c.dim(`→ ${base}`)}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
