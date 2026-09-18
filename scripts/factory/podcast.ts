import { mkdtemp, rm, readFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import type { PodcastRunOutcome, PodcastState } from "@prisma/client";
import { db } from "@/lib/db";
import { parseArgs } from "./lib/args.js";
import { run, requireBinary, CommandError } from "./lib/exec.js";
import { c, log, humanSize } from "./lib/log.js";
import { cleanupRemoteTmp, dockerCpToContainer, requireDeployHost, rsyncFile } from "./lib/prod.js";

/**
 * CLI: фабрика AI-подкастов — двухголосый обзор-диалог по уроку через NotebookLM
 * Audio Overview (неофициальный CLI notebooklm-py, браузерная автоматизация Google).
 * Это ОТДЕЛЬНЫЙ формат от «аудиоверсии урока» (factory:audio — дорожка из видео):
 * подкаст обсуждает материал двумя ведущими, как разбор, а не озвучка лекции.
 *
 *   pnpm factory:podcast --lesson <lessonId>
 *   pnpm factory:podcast --course <courseSlug>          # батч всех уроков с контентом
 *   pnpm factory:podcast --queue                        # все курсы по очереди, пока пускает квота
 *   опции: --force (перезаписать podcastKey), --length short|default|long,
 *          --format deep-dive|brief|critique|debate (по умолчанию deep-dive),
 *          --ship (см. ниже)
 *
 * Два режима доставки:
 *   • по умолчанию — m4a в локальный lib/storage, podcastKey в локальную БД; на прод
 *     доносит factory:publish;
 *   • --ship — автопрогон на Mac mini (deploy/mac/): DATABASE_URL смотрит в прод-БД
 *     через ssh-туннель, файл сразу уезжает в медиа-том прода (lib/prod.ts), и только
 *     после этого пишется podcastKey. Локальной копии и локальной БД нет вовсе —
 *     id уроков разойтись не с чем.
 *
 * Ход работы по урокам пишется в PodcastLessonStatus, прогоны очереди — в PodcastRun:
 * их показывает /admin/podcasts. Запись статуса — best effort: в локальной БД без
 * свежей миграции фабрика просто работает молча.
 *
 * Источник для генерации — текст урока из БД: конспект (AiArtifact SUMMARY, VALIDATED)
 * либо, если его нет, очищенный транскрипт. Видео/ссылку НЕ подаём — больше контроля.
 * Язык подкаста — русский (NotebookLM не поддерживает kk/uz).
 *
 * Готовый m4a лежит по ключу courses/<slug>/lessons/<id>/podcast.m4a и раздаётся
 * через /api/video/podcast/<lessonId> с проверкой доступа (как видео/аудио).
 *
 * Авторизация NotebookLM (NOTEBOOKLM_AUTH):
 *   • chrome (по умолчанию, макбук) — перед уроком cookie переимпортируются из Chrome;
 *   • refresh (мини) — разовый `notebooklm login`, дальше сессию держит агент
 *     `notebooklm auth refresh`, а фабрика лишь освежает её перед шагами.
 */

const LANGUAGE = "ru";

/** Выход процесса при исчерпанной квоте — чтобы автопрогон отличал её от прочих сбоев. */
const EXIT_RATE_LIMIT = 75; // EX_TEMPFAIL

/** Незавершённое аудио старше этого считаем брошенным и генерируем заново. */
const STALE_AUDIO_MS = 8 * 60 * 60 * 1000;

/**
 * Порядок курсов в очереди: сначала добить начатое, потом от коротких к длинным —
 * курсы закрываются целиком, а не все сразу наполовину. Не названные идут в конце.
 */
const QUEUE_ORDER = [
  "sales-realty",
  "sales-diy",
  "sales-shoes",
  "sales-spin",
  "sales-tourism",
  "sales-b2b",
  "time-management",
  "sales-kitchens",
  "sales-kitchens-basics",
];

/** NotebookLM ограничивает число Audio Overview в день — отличаем от прочих сбоев. */
function isRateLimit(e: unknown): boolean {
  const text = e instanceof CommandError ? e.stderr : e instanceof Error ? e.message : String(e);
  return /rate.?limit|quota/i.test(text);
}

/** Текст ошибки вместе с хвостом stderr CLI — иначе в логе один «код 1». */
function describe(e: unknown): string {
  if (e instanceof CommandError) {
    const tail = e.stderr.trim().split("\n").slice(-3).join(" | ");
    return tail ? `${e.message}: ${tail}` : e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Урок пропускаем в этом прогоне: аудио прошлого прогона ещё генерируется у Google. */
class PendingAudioError extends Error {}

/** Аудио сгенерировано, но не скачалось — ноутбук оставлен до следующего прогона. */
class AudioNotDownloadedError extends Error {}

interface LessonContent {
  id: string;
  title: string;
  courseSlug: string;
  courseTitle: string;
  podcastKey: string | null;
  sourceText: string;
}

interface Options {
  force: boolean;
  length: string;
  format: string;
  ship: boolean;
}

// ── Статус для админки ───────────────────────────────────────────────────────

let statusBroken = false;

/** Записать ход работы по уроку. Сбой записи не должен ронять генерацию. */
async function setStatus(
  lessonId: string,
  state: PodcastState,
  message: string | null = null,
  newAttempt = false,
): Promise<void> {
  if (statusBroken) return;
  try {
    await db.podcastLessonStatus.upsert({
      where: { lessonId },
      create: { lessonId, state, message, attempts: newAttempt ? 1 : 0 },
      update: { state, message, ...(newAttempt ? { attempts: { increment: 1 } } : {}) },
    });
  } catch (e) {
    statusBroken = true;
    log.warn(`Статус подкастов не пишется (нет миграции?): ${describe(e)}`);
  }
}

/** Подкаст на месте (или попытка откатилась) — строка статуса больше не нужна. */
async function clearStatus(lessonId: string): Promise<void> {
  if (statusBroken) return;
  await db.podcastLessonStatus.deleteMany({ where: { lessonId } }).catch(() => undefined);
}

async function startRun(): Promise<string | null> {
  const host = hostname();
  try {
    // На одной машине прогон всегда один (замок в раннере): всё, что числится
    // идущим с этого хоста, — оборвалось вместе с прошлым процессом.
    await db.podcastRun.updateMany({
      where: { host, outcome: "RUNNING" },
      data: { outcome: "FAILED", finishedAt: new Date(), message: "прогон оборвался" },
    });
    const created = await db.podcastRun.create({ data: { host } });
    return created.id;
  } catch (e) {
    log.warn(`Прогон не записан в PodcastRun: ${describe(e)}`);
    return null;
  }
}

async function finishRun(
  id: string | null,
  data: { outcome: PodcastRunOutcome; generated: number; failed: number; message?: string },
): Promise<void> {
  if (!id) return;
  await db.podcastRun
    .update({ where: { id }, data: { ...data, finishedAt: new Date() } })
    .catch((e: unknown) => log.warn(`Итог прогона не записан: ${describe(e)}`));
}

// ── Урок и его текст ─────────────────────────────────────────────────────────

/** Загрузить урок и связный текст для подкаста: конспект → иначе транскрипт. */
async function loadLessonContent(lessonId: string): Promise<LessonContent | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      podcastKey: true,
      module: { select: { course: { select: { slug: true, title: true } } } },
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
    courseTitle: lesson.module.course.title,
    podcastKey: lesson.podcastKey,
    sourceText,
  };
}

/**
 * Очередь: курсы в порядке QUEUE_ORDER и их уроки без подкаста, у которых есть
 * из чего генерировать. Уроки без конспекта и транскрипта (time-management)
 * в очередь не попадают вовсе — иначе каждый прогон спотыкался бы о них.
 */
async function loadQueue(): Promise<{ slug: string; title: string; lessonIds: string[] }[]> {
  const courses = await db.course.findMany({
    select: {
      slug: true,
      title: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          lessons: {
            where: { podcastKey: null },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              aiArtifacts: {
                where: { type: "SUMMARY", validation: "VALIDATED" },
                select: { id: true },
                take: 1,
              },
              transcript: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  const rank = (slug: string) => {
    const i = QUEUE_ORDER.indexOf(slug);
    return i === -1 ? QUEUE_ORDER.length : i;
  };

  return courses
    .map((course) => ({
      slug: course.slug,
      title: course.title,
      lessonIds: course.modules
        .flatMap((m) => m.lessons)
        .filter((l) => l.aiArtifacts.length > 0 || l.transcript?.status === "CLEANED")
        .map((l) => l.id),
    }))
    .filter((course) => course.lessonIds.length > 0)
    .sort((a, b) => rank(a.slug) - rank(b.slug));
}

// ── NotebookLM ───────────────────────────────────────────────────────────────

/**
 * Освежить авторизацию NotebookLM. На макбуке сессия Google живёт в Chrome, а
 * сохранённый storage_state протухает за минуты — переимпортируем cookie. На мини
 * Chrome не при чём: сессию держит `auth refresh` (агент + вызов перед шагами).
 */
async function reimportAuth(): Promise<void> {
  if (process.env.NOTEBOOKLM_AUTH === "refresh") {
    await run("notebooklm", ["auth", "refresh"]);
    return;
  }
  await run("notebooklm", ["login", "--browser-cookies", "chrome"]);
}

/** Извлечь id ноутбука из JSON-ответа CLI (`{id}` либо `{notebook:{id}}`). */
function extractId(stdout: string): string {
  const obj = JSON.parse(stdout) as { id?: string; notebook?: { id?: string } };
  const id = obj.id ?? obj.notebook?.id;
  if (!id) throw new Error(`Не удалось разобрать id ноутбука из ответа CLI: ${stdout.slice(0, 200)}`);
  return id;
}

/** Инструкция ведущим подкаста — задаёт тон и фокус под конкретный курс. */
function buildPrompt(lesson: LessonContent): string {
  return (
    `Это обучающий подкаст курса «${lesson.courseTitle}». ` +
    `Тема урока: «${lesson.title}». Объясните материал живо и по делу, как разбор для новичка: ` +
    `ключевые приёмы, типичные ошибки и короткие примеры реплик из диалога с клиентом. ` +
    `Опирайтесь только на источник, не добавляйте фактов из других сфер. ` +
    `Говорите на русском, по-деловому, без воды.`
  );
}

/**
 * Имя ноутбука несёт id урока — по нему следующий прогон находит ноутбук, если
 * этот оборвался после генерации (сбой скачивания, перезагрузка, обрыв связи).
 */
function notebookTitle(lesson: LessonContent): string {
  return `ACTIVE SALES · ${lesson.title} [${lesson.id}]`;
}

async function findNotebook(lesson: LessonContent): Promise<string | null> {
  const { stdout } = await run("notebooklm", ["list", "--json"]);
  const list = JSON.parse(stdout) as { notebooks?: { id: string; title: string }[] };
  return list.notebooks?.find((n) => n.title.endsWith(`[${lesson.id}]`))?.id ?? null;
}

async function findAudio(notebookId: string): Promise<{ status: string; createdAt: Date } | null> {
  const { stdout } = await run("notebooklm", ["artifact", "list", "-n", notebookId, "--json"]);
  const artifacts = (JSON.parse(stdout) as {
    artifacts?: { type_id?: string; status?: string; created_at?: string }[];
  }).artifacts;
  const audio = artifacts?.find((a) => a.type_id === "audio");
  if (!audio) return null;
  return { status: audio.status ?? "unknown", createdAt: new Date(audio.created_at ?? 0) };
}

async function deleteNotebook(notebookId: string): Promise<void> {
  try {
    await run("notebooklm", ["delete", "-n", notebookId, "-y"]);
  } catch (e) {
    log.warn(`Не удалось удалить ноутбук ${notebookId}: ${describe(e)}`);
  }
}

/**
 * Скачать готовое аудио и только потом убрать ноутбук. Скачивание идёт через
 * 10–40 минут после входа, cookie к этому времени протухают — поэтому перед каждой
 * попыткой авторизация освежается. Если все попытки мимо, ноутбук ОСТАЁТСЯ:
 * аудио уже оплачено квотой, следующий прогон его докачает без новой генерации.
 */
async function downloadAndClean(lesson: LessonContent, notebookId: string, outFile: string): Promise<void> {
  const pauses = [0, 30_000, 120_000];
  let lastError: unknown;
  for (const [attempt, pause] of pauses.entries()) {
    if (pause) await new Promise((r) => setTimeout(r, pause));
    try {
      await reimportAuth();
      log.step(`NotebookLM: скачиваю аудио${attempt ? ` (попытка ${attempt + 1})` : ""}`);
      await run("notebooklm", ["download", "audio", outFile, "-n", notebookId]);
      await deleteNotebook(notebookId);
      return;
    } catch (e) {
      lastError = e;
      log.warn(`Скачивание не удалось: ${describe(e)}`);
    }
  }
  const message = `аудио сгенерировано, но не скачалось — ноутбук ${notebookId} оставлен, следующий прогон докачает: ${describe(lastError)}`;
  await setStatus(lesson.id, "AUDIO_READY", message);
  throw new AudioNotDownloadedError(message);
}

/** Получить m4a урока в outFile: докачать хвост прошлого прогона или сгенерировать заново. */
async function generatePodcast(lesson: LessonContent, opts: Options, outFile: string): Promise<void> {
  // 0. Хвост прошлого прогона: готовое аудио докачиваем, свежее ждём, брошенное — в корзину.
  const leftover = await findNotebook(lesson);
  if (leftover) {
    const audio = await findAudio(leftover);
    if (audio?.status === "completed") {
      log.step("NotebookLM: аудио уже сгенерировано прошлым прогоном — докачиваю без траты квоты");
      await setStatus(lesson.id, "AUDIO_READY", "докачиваю аудио прошлого прогона");
      return downloadAndClean(lesson, leftover, outFile);
    }
    if (audio && audio.status !== "failed" && Date.now() - audio.createdAt.getTime() < STALE_AUDIO_MS) {
      const message = `аудио прошлого прогона ещё генерируется (${audio.status}) — дождусь в следующий раз`;
      await setStatus(lesson.id, "WAITING", message);
      throw new PendingAudioError(message);
    }
    log.warn("Брошенный ноутбук прошлого прогона без готового аудио — удаляю и начинаю заново");
    await deleteNotebook(leftover);
  }

  // 1. Ноутбук под урок.
  log.step("NotebookLM: создаю ноутбук");
  const created = await run("notebooklm", ["create", notebookTitle(lesson), "--json"]);
  const notebookId = extractId(created.stdout);

  // 2. Источник — текст урока (inline, не файл: NotebookLM надёжнее принимает text).
  try {
    log.step("NotebookLM: добавляю источник (текст урока)");
    await run("notebooklm", [
      "source", "add", lesson.sourceText,
      "--type", "text",
      "--title", lesson.title,
      "-n", notebookId,
      "--json",
    ]);
  } catch (e) {
    await deleteNotebook(notebookId);
    throw e;
  }

  // 3. Генерация подкаста (ждём завершения; до 30 мин).
  log.step(`NotebookLM: генерирую подкаст (${opts.format}, ${opts.length}, ${LANGUAGE}) — это несколько минут`);
  await setStatus(lesson.id, "GENERATING", null, true);
  let status: string | undefined;
  try {
    const gen = await run("notebooklm", [
      "generate", "audio", buildPrompt(lesson),
      "-n", notebookId,
      "--format", opts.format,
      "--length", opts.length,
      "--language", LANGUAGE,
      "--wait",
      "--timeout", "1800",
      "--json",
    ]);
    status = (JSON.parse(gen.stdout) as { status?: string }).status;
  } catch (e) {
    // Квота — аудио не создано, ноутбук пустой. Прочий сбой (таймаут ожидания, обрыв)
    // — генерация у Google могла продолжиться, ноутбук оставляем для следующего прогона.
    if (isRateLimit(e)) await deleteNotebook(notebookId);
    throw e;
  }
  if (status !== "completed") {
    await deleteNotebook(notebookId);
    throw new Error(`NotebookLM вернул статус «${status}», ожидался «completed»`);
  }

  // 4. Скачать (по факту m4a/AAC, несмотря на расширение) и убрать ноутбук.
  await setStatus(lesson.id, "AUDIO_READY", "аудио готово, скачиваю");
  return downloadAndClean(lesson, notebookId, outFile);
}

// ── Урок целиком ─────────────────────────────────────────────────────────────

async function processLesson(lessonId: string, opts: Options): Promise<{ sizeBytes: number } | null> {
  const lesson = await loadLessonContent(lessonId);
  if (!lesson) return null;

  if (lesson.podcastKey && !opts.force) {
    log.warn(`Урок «${lesson.title}» уже с подкастом — пропуск (--force для перезаписи)`);
    return null;
  }

  const key = `courses/${lesson.courseSlug}/lessons/${lesson.id}/podcast.m4a`;
  const workDir = await mkdtemp(join(tmpdir(), `salesup-podcast-${lesson.id}-`));
  const outFile = join(workDir, "podcast.m4a");

  try {
    await reimportAuth(); // освежить сессию — иначе на длинном батче авторизация протухает
    await generatePodcast(lesson, opts, outFile);
    const data = await readFile(outFile);

    if (opts.ship) {
      // Сначала файл в том прода, потом ключ в прод-БД: иначе ученик увидит
      // подкаст, которого на диске ещё нет.
      log.step(`Отправляю на прод: ${c.dim(key)}`);
      await setStatus(lesson.id, "SHIPPING");
      const remote = rsyncFile(outFile, key, false);
      dockerCpToContainer(remote, key, false);
    } else {
      // Локальное хранилище тянет за собой полную проверку env — на мини её нет.
      const { storage } = await import("@/lib/storage");
      log.step(`Загружаю в хранилище: ${c.dim(key)}`);
      await storage.delete(key); // идемпотентность
      await storage.put(key, data);
    }
    await db.lesson.update({ where: { id: lesson.id }, data: { podcastKey: key } });
    await clearStatus(lesson.id);

    log.ok(`Подкаст урока «${lesson.title}» готов: ${humanSize(data.length)}`);
    return { sizeBytes: data.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

type Attempt =
  | { kind: "done"; sizeBytes: number }
  | { kind: "skipped" }
  | { kind: "quota" }
  | { kind: "failed" };

/** Одна попытка по уроку с изоляцией: сбой урока не валит батч, квота — останавливает. */
async function attemptLesson(id: string, opts: Options): Promise<Attempt> {
  try {
    const r = await processLesson(id, opts);
    return r ? { kind: "done", sizeBytes: r.sizeBytes } : { kind: "skipped" };
  } catch (e) {
    if (isRateLimit(e)) {
      // Попытки не было — урок снова просто в очереди.
      await clearStatus(id);
      log.err("NotebookLM: дневная квота на генерацию аудио исчерпана. Повторите через 1–24 ч (готовые пропустятся).");
      return { kind: "quota" };
    }
    if (e instanceof PendingAudioError || e instanceof AudioNotDownloadedError) {
      log.warn(`Урок ${id}: ${e.message}`);
      return { kind: "failed" };
    }
    const message = describe(e);
    await setStatus(id, "FAILED", message);
    log.err(`Урок ${id}: ${message}`);
    return { kind: "failed" };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const opts: Options = {
    force: args.options.force === true,
    length: typeof args.options.length === "string" ? args.options.length : "default",
    format: typeof args.options.format === "string" ? args.options.format : "deep-dive",
    ship: args.options.ship === true,
  };

  await requireBinary(
    "notebooklm",
    "Установите: uv tool install 'notebooklm-py[browser,cookies]', затем notebooklm login --browser-cookies chrome",
  );
  if (opts.ship) requireDeployHost();

  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const lessonId = typeof args.options.lesson === "string" ? args.options.lesson : null;
  const queue = args.options.queue === true;

  let total = 0;
  let processed = 0;
  let rateLimited = false;
  // Сбои и «до чего не дошли» — разные вещи: первое чинят, второе просто ждёт
  // следующего прогона. В сводке прогона считается только первое.
  const failed: string[] = [];
  const pending: string[] = [];

  const count = (id: string, r: Attempt): void => {
    if (r.kind === "done") {
      total += r.sizeBytes;
      processed++;
    } else if (r.kind === "failed") {
      failed.push(id);
    } else if (r.kind === "quota") {
      rateLimited = true;
    }
  };

  /** Пройти уроки по порядку; false — упёрлись в квоту, дальше идти незачем. */
  const runLessons = async (ids: string[]): Promise<boolean> => {
    for (const [i, id] of ids.entries()) {
      console.log(`\n${c.bold(`[${i + 1}/${ids.length}]`)}`);
      const r = await attemptLesson(id, opts);
      count(id, r);
      if (r.kind === "quota") {
        pending.push(...ids.slice(i));
        return false;
      }
    }
    return true;
  };

  try {
    if (queue) {
      const runId = await startRun();
      let outcome: PodcastRunOutcome = "DONE";
      let message: string | undefined;
      try {
        // Протухшая сессия Google уронила бы каждый урок по отдельности — проверяем
        // один раз и говорим в админке прямо, что нужен повторный вход.
        try {
          await reimportAuth();
        } catch (e) {
          throw new Error(
            `NotebookLM: сессия Google недействительна — войдите заново на мини (deploy/mac/bin/notebooklm-login.command): ${describe(e)}`,
          );
        }
        const courses = await loadQueue();
        if (!courses.length) message = "очередь пуста — у всех уроков с материалом есть подкаст";
        for (const course of courses) {
          log.step(`Курс «${course.title}»: без подкаста ${course.lessonIds.length}`);
          if (!(await runLessons(course.lessonIds))) {
            outcome = "QUOTA";
            break;
          }
        }
      } catch (e) {
        outcome = "FAILED";
        message = describe(e);
        throw e;
      } finally {
        await finishRun(runId, { outcome, generated: processed, failed: failed.length, message });
      }
    } else if (courseSlug) {
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
      await runLessons(ids);
    } else if (lessonId) {
      count(lessonId, await attemptLesson(lessonId, opts));
    } else {
      throw new Error("Укажите --lesson <id>, --course <slug> или --queue");
    }
  } finally {
    if (opts.ship) cleanupRemoteTmp(false);
  }

  if (failed.length) {
    log.warn(`Не удалось: ${failed.length} — повторите для них (готовые пропустятся): ${failed.join(" ")}`);
  }
  if (pending.length) {
    log.info(`Осталось на следующий прогон: ${pending.length}`);
  }
  log.ok(`Готово: ${processed} подкастов, суммарно ${humanSize(total)}`);
  await db.$disconnect();
  if (rateLimited) process.exitCode = EXIT_RATE_LIMIT;
}

main().catch(async (e: unknown) => {
  log.err(describe(e));
  await db.$disconnect();
  process.exit(isRateLimit(e) ? EXIT_RATE_LIMIT : 1);
});
