import { mkdtemp, rm, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, extname } from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary } from "./lib/exec.js";
import { c, log, humanSize } from "./lib/log.js";
import {
  DEPLOY_HOST,
  DEPLOY_SSH_PORT,
  DEPLOY_DB_CONTAINER,
  DEPLOY_MEDIA_CONTAINER,
  requireDeployHost,
  psqlRows,
  rsyncFile,
  dockerCpToContainer,
  updateProdMediaKey,
  cleanupRemoteTmp,
} from "./lib/prod.js";

/**
 * CLI: импорт ГОТОВЫХ презентаций уроков (сделанных вручную) в курс.
 *
 * Альтернатива factory:slides-pdf (генерация через NotebookLM): владелец сам
 * готовит колоды в PowerPoint/Keynote, складывает по подпапке на урок, а эта
 * команда конвертирует .pptx → PDF (LibreOffice headless) и подставляет их
 * вместо существующих презентаций. Просмотрщик остаётся прежним —
 * <PdfSlideViewer> поверх /api/learn/slides-pdf/<lessonId> (см. lesson-tabs).
 *
 *   pnpm factory:slides-import --dir "<каталог>" --course sales-pharma [--dry-run]
 *   pnpm factory:slides-import --dir "<каталог>" --course sales-pharma --target prod
 *
 * Структура каталога: одна подпапка на урок, внутри — ровно один .pptx (или .pdf,
 * тогда конвертация не нужна). Имя подпапки сопоставляется с названием урока по
 * совпадению слов («01-7 вопросов» → «7 вопросов для выявления потребностей
 * клиента»); неоднозначные и несопоставленные подпапки печатаются и валят запуск —
 * автоматика не должна молча подставить презентацию не в тот урок.
 *
 * Куда пишется:
 *   --target local (по умолчанию) — локальный MEDIA_ROOT + локальная dev-БД;
 *   --target prod                 — том media и БД на VPS (ключи резолвятся по
 *                                   прод-id урока, см. lib/prod.ts).
 * Ключ хранилища тот же, что у factory:slides-pdf:
 *   courses/<slug>/lessons/<id>/slides.pdf
 */

const RU_YO = /ё/g;

interface LessonRow {
  id: string;
  title: string;
  slidesPdfKey: string | null;
}

interface DeckSource {
  folder: string; // имя подпапки (для логов)
  file: string; // абсолютный путь к .pptx/.pdf
}

interface Match {
  source: DeckSource;
  lesson: LessonRow;
}

// ── Сопоставление подпапка → урок ────────────────────────────────────────────

/**
 * Слова названия: без пунктуации и ё/е-различий. `stripOrdinal` убирает порядковый
 * префикс имени папки («01-», «14 ») — в названиях уроков ведущее число значимо
 * («7 вопросов…» vs «3 вида…»), поэтому там его не трогаем.
 */
function tokens(text: string, stripOrdinal = false): string[] {
  const base = stripOrdinal ? text.replace(/^\s*\d+[\s._-]+/, "") : text;
  return base
    .toLowerCase()
    .replace(RU_YO, "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

/** Совпадение слов с поправкой на падежи: общий префикс ≥5 букв (или равенство). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  if (n < 5) return false;
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i >= 5;
}

/** Доля слов подпапки, найденных в названии урока (0..1). */
function score(folder: string, lessonTitle: string): number {
  const ft = tokens(folder, true);
  if (ft.length === 0) return 0;
  const lt = tokens(lessonTitle);
  const hit = ft.filter((f) => lt.some((l) => sameWord(f, l))).length;
  return hit / ft.length;
}

/** Доля слов урока, покрытых названием подпапки (0..1) — разводит вложенные названия. */
function coverage(folder: string, lessonTitle: string): number {
  const lt = tokens(lessonTitle);
  if (lt.length === 0) return 0;
  const ft = tokens(folder, true);
  const hit = lt.filter((l) => ft.some((f) => sameWord(f, l))).length;
  return hit / lt.length;
}

/**
 * Сопоставить подпапки с уроками курса: лучший кандидат должен набрать ≥0.6 и
 * строго обойти второго. При равной доле слов побеждает урок, чьё название покрыто
 * папкой полнее — иначе «8 ошибок…» и «8 финансовых ошибок…» неразличимы.
 * Один урок — одна презентация (двойное попадание = ошибка).
 */
function matchDecks(sources: DeckSource[], lessons: LessonRow[]): Match[] {
  const matches: Match[] = [];
  const taken = new Map<string, string>(); // lessonId → folder

  for (const source of sources) {
    const ranked = lessons
      .map((lesson) => ({
        lesson,
        s: score(source.folder, lesson.title),
        cov: coverage(source.folder, lesson.title),
      }))
      .sort((a, b) => b.s - a.s || b.cov - a.cov);

    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.s < 0.6) {
      throw new Error(
        `Не найден урок для папки «${source.folder}» (лучшее совпадение: ` +
          `${best ? `«${best.lesson.title}» ${Math.round(best.s * 100)}%` : "нет"})`,
      );
    }
    if (second && second.s >= best.s && second.cov >= best.cov) {
      throw new Error(
        `Неоднозначное совпадение для папки «${source.folder}»: ` +
          `«${best.lesson.title}» и «${second.lesson.title}»`,
      );
    }
    const already = taken.get(best.lesson.id);
    if (already) {
      throw new Error(
        `Урок «${best.lesson.title}» претендуют занять две папки: «${already}» и «${source.folder}»`,
      );
    }
    taken.set(best.lesson.id, source.folder);
    matches.push({ source, lesson: best.lesson });
  }

  return matches;
}

// ── Чтение каталога с презентациями ─────────────────────────────────────────

/** Подпапки каталога, в каждой — ровно один .pptx (приоритет) или .pdf. */
async function collectSources(dir: string): Promise<DeckSource[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ru"));

  const sources: DeckSource[] = [];
  for (const folder of folders) {
    const files = (await readdir(join(dir, folder))).filter((f) => !f.startsWith("."));
    const pptx = files.filter((f) => extname(f).toLowerCase() === ".pptx");
    const pdf = files.filter((f) => extname(f).toLowerCase() === ".pdf");
    const picked = pptx[0] ?? pdf[0];
    if (!picked) {
      log.warn(`Папка «${folder}» без .pptx/.pdf — пропуск`);
      continue;
    }
    if (pptx.length > 1) {
      throw new Error(`В папке «${folder}» несколько .pptx — оставьте один`);
    }
    sources.push({ folder, file: join(dir, folder, picked) });
  }
  if (sources.length === 0) throw new Error(`В каталоге ${dir} нет подпапок с презентациями`);
  return sources;
}

// ── Уроки курса: локальная БД или прод ──────────────────────────────────────

async function loadLessonsLocal(slug: string): Promise<LessonRow[]> {
  const course = await db.course.findUnique({
    where: { slug },
    select: {
      title: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, slidesPdfKey: true },
          },
        },
      },
    },
  });
  if (!course) throw new Error(`Курс «${slug}» не найден в локальной БД`);
  log.step(`Курс «${course.title}» (локальная БД)`);
  return course.modules.flatMap((m) => m.lessons);
}

function loadLessonsProd(slug: string): LessonRow[] {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Подозрительный slug: ${slug}`);
  const rows = psqlRows(
    `SELECT l.id, l.title, coalesce(l."slidesPdfKey", '') FROM "Lesson" l ` +
      `JOIN "Module" m ON m.id = l."moduleId" ` +
      `JOIN "Course" c ON c.id = m."courseId" ` +
      `WHERE c.slug = '${slug}' ORDER BY m."sortOrder", l."sortOrder"`,
  );
  if (rows.length === 0) throw new Error(`Курс «${slug}» не найден в прод-БД (или без уроков)`);
  log.step(`Курс «${slug}» (прод-БД, уроков: ${rows.length})`);
  return rows.map(([id, title, key]) => ({
    id: id ?? "",
    title: title ?? "",
    slidesPdfKey: key ? key : null,
  }));
}

// ── Конвертация ─────────────────────────────────────────────────────────────

/** .pptx → PDF через LibreOffice headless; .pdf берётся как есть. */
async function toPdf(file: string, workDir: string): Promise<Buffer> {
  if (extname(file).toLowerCase() === ".pdf") return readFile(file);

  await run("soffice", ["--headless", "--convert-to", "pdf", "--outdir", workDir, file]);
  const out = join(workDir, `${basename(file, extname(file))}.pdf`);
  const data = await readFile(out).catch(() => {
    throw new Error(`LibreOffice не создал PDF для ${basename(file)}`);
  });
  return data;
}

// ── Точка входа ─────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = typeof args.options.dir === "string" ? args.options.dir : null;
  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const target = args.options.target === "prod" ? "prod" : "local";
  const dryRun = args.options["dry-run"] === true;

  if (!dir || !courseSlug) {
    throw new Error(
      'Использование: pnpm factory:slides-import --dir "<каталог>" --course <slug> ' +
        "[--target local|prod] [--dry-run]",
    );
  }

  await requireBinary("soffice", "Установите LibreOffice: brew install --cask libreoffice");
  if (target === "prod") {
    requireDeployHost();
    log.step(`VPS: ${c.dim(DEPLOY_HOST)} (порт ${DEPLOY_SSH_PORT})`);
    log.step(`Прод: ${c.dim(`${DEPLOY_DB_CONTAINER} / ${DEPLOY_MEDIA_CONTAINER}:/media`)}`);
  }
  if (dryRun) log.warn("Режим --dry-run: изменений не будет");

  const sources = await collectSources(dir);
  const lessons = target === "prod" ? loadLessonsProd(courseSlug) : await loadLessonsLocal(courseSlug);
  const matches = matchDecks(sources, lessons);

  console.log("");
  log.step("Сопоставление папок с уроками:");
  for (const m of matches) {
    const mark = m.lesson.slidesPdfKey ? c.yellow("замена") : c.green("новая ");
    console.log(`  ${mark}  ${m.source.folder}  ${c.dim("→")}  ${m.lesson.title}`);
  }
  const without = lessons.filter((l) => !matches.some((m) => m.lesson.id === l.id));
  if (without.length > 0) {
    log.info(`Без презентации остаются: ${without.map((l) => l.title).join("; ")}`);
  }
  console.log("");

  const workDir = await mkdtemp(join(tmpdir(), "salesup-slides-import-"));
  let done = 0;
  let totalBytes = 0;

  try {
    for (const [i, m] of matches.entries()) {
      console.log(`${c.bold(`[${i + 1}/${matches.length}]`)} ${m.lesson.title}`);
      const key = `courses/${courseSlug}/lessons/${m.lesson.id}/slides.pdf`;

      const pdf = await toPdf(m.source.file, workDir);
      log.info(`${basename(m.source.file)} → PDF, ${humanSize(pdf.length)}`);

      if (dryRun) {
        log.info(`[dry-run] → ${key}`);
        done++;
        totalBytes += pdf.length;
        continue;
      }

      if (target === "local") {
        await storage.delete(key); // идемпотентность
        await storage.put(key, pdf);
        await db.lesson.update({ where: { id: m.lesson.id }, data: { slidesPdfKey: key } });
      } else {
        // Прод: файл кладём во временный каталог, дальше rsync + docker cp + UPDATE.
        const staged = join(workDir, "upload", key);
        await mkdir(join(staged, ".."), { recursive: true });
        await writeFile(staged, pdf);
        const remoteTmp = rsyncFile(staged, key, false);
        dockerCpToContainer(remoteTmp, key, false);
        updateProdMediaKey(m.lesson.id, "slidesPdfKey", key, false);
      }

      log.ok(`Готово: ${c.dim(key)}`);
      done++;
      totalBytes += pdf.length;
      console.log("");
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
    if (target === "prod") cleanupRemoteTmp(dryRun);
  }

  console.log("─".repeat(60));
  log.ok(
    `${dryRun ? "[dry-run] " : ""}Презентаций импортировано: ${done}/${matches.length}, ` +
      `суммарно ${humanSize(totalBytes)} (${target})`,
  );
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
