/**
 * factory:publish — публикация медиа-файлов фабрики на прод.
 *
 * Фабрика (factory:audio, factory:podcast) пишет медиа в ЛОКАЛЬНЫЙ каталог
 * MEDIA_ROOT и ключи (audioKey, podcastKey) в ЛОКАЛЬНУЮ dev-БД.
 * Прод-БД и прод-том (salesup_media) — отдельные. Эта команда синхронизует:
 *   1. Для каждого непустого ключа: rsync локального файла media/<key>
 *      на VPS в /tmp/salesup-publish-<ts>/<key>, затем docker cp в контейнер
 *      DEPLOY_MEDIA_CONTAINER (default: salesup-worker-1) по тому же
 *      относительному пути /media/<key>.
 *   2. UPDATE прод-БД через ssh + docker exec ... psql (идемпотентно).
 *
 * Использование:
 *   pnpm factory:publish --course <slug>    # все уроки курса с медиа-ключами
 *   pnpm factory:publish --lesson <id>      # один урок
 *   pnpm factory:publish --course <slug> --dry-run  # показать план без изменений
 *
 * Переменные окружения (.env.deploy или env, НЕ хардкодить секреты):
 *   DEPLOY_HOST         user@host  (пример: administrator@69.197.178.118)
 *   DEPLOY_SSH_PORT     SSH-порт VPS (default: 22)
 *   DEPLOY_DB_CONTAINER имя контейнера с PostgreSQL на VPS (default: salesup-db-1)
 *   DEPLOY_MEDIA_CONTAINER  имя контейнера с томом media (default: salesup-worker-1)
 *   DEPLOY_DB_USER      пользователь PostgreSQL (default: salesacademy)
 *   DEPLOY_DB_NAME      имя БД (default: salesacademy)
 *   MEDIA_ROOT          локальный корень медиа (default: ./media)
 *
 * Безопасность:
 *   • rsync только добавляет/обновляет файлы (без --delete).
 *   • UPDATE касается ТОЛЬКО audioKey/podcastKey конкретного урока по id.
 *   • Ключи детерминированы (courses/<slug>/lessons/<id>/...) — SQL-инъекция невозможна.
 *   • Секреты (пароль PostgreSQL) не передаются — psql читает их из env контейнера.
 */

import { execSync, execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { db } from "@/lib/db";
import { parseArgs } from "./lib/args.js";
import { c, log, humanSize } from "./lib/log.js";

// ── Конфигурация из env ──────────────────────────────────────────────────────

const DEPLOY_HOST = process.env.DEPLOY_HOST ?? "";
const DEPLOY_SSH_PORT = process.env.DEPLOY_SSH_PORT ?? "22";
const DEPLOY_DB_CONTAINER = process.env.DEPLOY_DB_CONTAINER ?? "salesup-db-1";
const DEPLOY_MEDIA_CONTAINER = process.env.DEPLOY_MEDIA_CONTAINER ?? "salesup-worker-1";
const DEPLOY_DB_USER = process.env.DEPLOY_DB_USER ?? "salesacademy";
const DEPLOY_DB_NAME = process.env.DEPLOY_DB_NAME ?? "salesacademy";
const MEDIA_ROOT = process.env.MEDIA_ROOT ?? join(process.cwd(), "media");

// ── Типы ─────────────────────────────────────────────────────────────────────

interface MediaKey {
  field: "audioKey" | "podcastKey";
  key: string; // относительный ключ, напр. courses/sales-pharma/lessons/<id>/podcast.m4a
}

interface LessonMedia {
  id: string;
  title: string;
  keys: MediaKey[];
}

// ── Хелперы SSH/rsync/docker ─────────────────────────────────────────────────

/** Выполнить команду на VPS по SSH, вернуть stdout. */
function sshExec(cmd: string, silent = false): string {
  if (!silent) log.info(`ssh: ${c.dim(cmd)}`);
  return execFileSync(
    "ssh",
    ["-p", DEPLOY_SSH_PORT, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", DEPLOY_HOST, cmd],
    { encoding: "utf-8", stdio: ["inherit", "pipe", "pipe"] },
  ).trim();
}

/**
 * Rsync одного файла на VPS в /tmp/salesup-publish/<key>.
 * Создаёт родительские каталоги на VPS автоматически.
 * Возвращает путь к файлу на VPS.
 *
 * Примечание: без --delete (добавляет/обновляет, не трогает остальное).
 * macOS rsync (BSD) не поддерживает --no-delete; просто не передаём --delete.
 */
function rsyncFile(localPath: string, remoteKey: string, dryRun: boolean): string {
  const remoteTmp = `/tmp/salesup-publish/${remoteKey}`;
  const remoteDir = dirname(remoteTmp);

  // Создать каталог на VPS (пропускаем в dry-run — ssh всё равно нужен)
  if (!dryRun) {
    sshExec(`mkdir -p '${remoteDir}'`, true);
  }

  // -e "ssh -p PORT ..." — передаём как одну строку для rsync -e
  const sshOpt = `ssh -p ${DEPLOY_SSH_PORT} -o BatchMode=yes -o ConnectTimeout=15`;
  const args = [
    "-az",
    // БЕЗ --delete — rsync по умолчанию только добавляет/обновляет
    "-e", sshOpt,
    ...(dryRun ? ["--dry-run"] : []),
    localPath,
    `${DEPLOY_HOST}:${remoteTmp}`,
  ];

  log.info(`rsync → ${c.dim(remoteTmp)}`);
  execFileSync("rsync", args, { stdio: ["inherit", "inherit", "inherit"] });

  return remoteTmp;
}

/**
 * Docker cp с VPS tmp-пути в контейнер /media/<key>.
 * Перед cp создаёт родительский каталог внутри контейнера.
 */
function dockerCpToContainer(remoteTmpPath: string, mediaKey: string, dryRun: boolean): void {
  const containerDest = `/media/${mediaKey}`;
  const containerDir = dirname(containerDest);

  if (dryRun) {
    log.info(`[dry-run] docker cp ${remoteTmpPath} → ${DEPLOY_MEDIA_CONTAINER}:${containerDest}`);
    return;
  }

  sshExec(`docker exec ${DEPLOY_MEDIA_CONTAINER} mkdir -p '${containerDir}'`, true);
  // docker cp не поддерживает --chown, но контейнер запущен от root и том принадлежит node (1000)
  // После cp делаем chown внутри контейнера
  sshExec(
    `docker cp '${remoteTmpPath}' ${DEPLOY_MEDIA_CONTAINER}:${containerDest}`,
    false,
  );
  sshExec(
    `docker exec ${DEPLOY_MEDIA_CONTAINER} chown 1000:1000 '${containerDest}'`,
    true,
  );
  log.ok(`Скопировано в контейнер: ${c.dim(containerDest)}`);
}

/**
 * UPDATE audioKey или podcastKey в прод-БД через docker exec psql.
 * Значение ключа детерминировано (путь без кавычек-опасностей).
 * Для дополнительной безопасности экранируем через $$ quoting SQL-литерал.
 */
function updateProdDb(lessonId: string, field: "audioKey" | "podcastKey", key: string, dryRun: boolean): void {
  // Проверка: ключ должен соответствовать ожидаемому шаблону (безопасность)
  if (!/^courses\/[a-z0-9-]+\/lessons\/[a-z0-9]+\/[a-z0-9._-]+$/.test(key)) {
    throw new Error(`Подозрительный ключ (не проходит валидацию): ${key}`);
  }
  // lessonId — cuid из Prisma, только [a-z0-9]
  if (!/^[a-z0-9]+$/.test(lessonId)) {
    throw new Error(`Подозрительный lessonId: ${lessonId}`);
  }

  // psql-поле в кавычках (camelCase Prisma), значение через строку PostgreSQL
  const sql = `UPDATE "Lesson" SET "${field}" = '${key}' WHERE id = '${lessonId}' AND ("${field}" IS NULL OR "${field}" != '${key}');`;

  if (dryRun) {
    log.info(`[dry-run] psql: ${c.dim(sql)}`);
    return;
  }

  const result = sshExec(
    `docker exec ${DEPLOY_DB_CONTAINER} psql -U ${DEPLOY_DB_USER} -d ${DEPLOY_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
    false,
  );
  log.ok(`БД обновлена (${field}): ${c.dim(result.trim())}`);
}

// ── Загрузка данных из локальной БД ─────────────────────────────────────────

async function loadLessonsForCourse(slug: string): Promise<LessonMedia[]> {
  const course = await db.course.findUnique({
    where: { slug },
    select: {
      title: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        select: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              audioKey: true,
              podcastKey: true,
            },
          },
        },
      },
    },
  });
  if (!course) throw new Error(`Курс «${slug}» не найден в локальной БД`);

  log.step(`Курс «${course.title}»`);

  const lessons = course.modules.flatMap((m) => m.lessons);
  return lessons
    .map((l) => {
      const keys: MediaKey[] = [];
      if (l.audioKey) keys.push({ field: "audioKey", key: l.audioKey });
      if (l.podcastKey) keys.push({ field: "podcastKey", key: l.podcastKey });
      return { id: l.id, title: l.title, keys };
    })
    .filter((l) => l.keys.length > 0);
}

async function loadSingleLesson(lessonId: string): Promise<LessonMedia[]> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      audioKey: true,
      podcastKey: true,
    },
  });
  if (!lesson) throw new Error(`Урок ${lessonId} не найден в локальной БД`);

  const keys: MediaKey[] = [];
  if (lesson.audioKey) keys.push({ field: "audioKey", key: lesson.audioKey });
  if (lesson.podcastKey) keys.push({ field: "podcastKey", key: lesson.podcastKey });

  if (keys.length === 0) {
    log.warn(`Урок «${lesson.title}» не имеет audioKey / podcastKey — нечего публиковать`);
    return [];
  }

  return [{ id: lesson.id, title: lesson.title, keys }];
}

// ── Публикация одного урока ─────────────────────────────────────────────────

async function publishLesson(lesson: LessonMedia, dryRun: boolean): Promise<number> {
  let synced = 0;

  for (const { field, key } of lesson.keys) {
    const localFile = join(MEDIA_ROOT, key);

    if (!existsSync(localFile)) {
      log.warn(`Файл не найден локально: ${c.dim(localFile)} — пропуск`);
      continue;
    }

    const fileSize = statSync(localFile).size;
    log.step(`${field}: ${c.dim(key)} (${humanSize(fileSize)})`);

    // 1. Rsync на VPS в /tmp
    const remoteTmpPath = rsyncFile(localFile, key, dryRun);

    // 2. docker cp в контейнер (или dry-run лог)
    if (!dryRun) {
      dockerCpToContainer(remoteTmpPath, key, dryRun);
    } else {
      log.info(`[dry-run] docker cp → ${DEPLOY_MEDIA_CONTAINER}:/media/${key}`);
    }

    // 3. UPDATE прод-БД
    updateProdDb(lesson.id, field, key, dryRun);

    synced++;
  }

  return synced;
}

// ── Очистка tmp на VPS ───────────────────────────────────────────────────────

function cleanupRemoteTmp(dryRun: boolean): void {
  if (dryRun) return;
  try {
    sshExec("rm -rf /tmp/salesup-publish", true);
  } catch {
    log.warn("Не удалось удалить /tmp/salesup-publish на VPS (некритично)");
  }
}

// ── Точка входа ──────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.options["dry-run"] === true;
  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const lessonId = typeof args.options.lesson === "string" ? args.options.lesson : null;

  if (!courseSlug && !lessonId) {
    throw new Error(
      "Укажите --course <slug> или --lesson <id>.\n" +
        "  pnpm factory:publish --course sales-pharma\n" +
        "  pnpm factory:publish --lesson <cuid>\n" +
        "  добавьте --dry-run для предпросмотра без изменений",
    );
  }

  if (!DEPLOY_HOST) {
    throw new Error(
      "DEPLOY_HOST не задан. Добавьте в .env.deploy:\n" +
        "  DEPLOY_HOST=administrator@69.197.178.118\n" +
        "  DEPLOY_SSH_PORT=4822",
    );
  }

  if (dryRun) {
    log.warn("Режим --dry-run: изменений на проде не будет");
  }

  log.step(`VPS: ${c.dim(DEPLOY_HOST)} (порт ${DEPLOY_SSH_PORT})`);
  log.step(`Локальный MEDIA_ROOT: ${c.dim(MEDIA_ROOT)}`);
  log.step(`Прод-БД: ${c.dim(`${DEPLOY_DB_CONTAINER} → ${DEPLOY_DB_NAME}`)}`);
  log.step(`Прод-том: ${c.dim(DEPLOY_MEDIA_CONTAINER)}:/media`);
  console.log("");

  // Загрузить список уроков из локальной БД
  const lessons = courseSlug
    ? await loadLessonsForCourse(courseSlug)
    : await loadSingleLesson(lessonId!);

  if (lessons.length === 0) {
    log.warn("Нет уроков с медиа-ключами для публикации");
    await db.$disconnect();
    return;
  }

  const totalKeys = lessons.reduce((s, l) => s + l.keys.length, 0);
  log.step(`Найдено уроков с медиа: ${lessons.length}, ключей: ${totalKeys}`);
  console.log("");

  let totalSynced = 0;

  for (const [i, lesson] of lessons.entries()) {
    console.log(`${c.bold(`[${i + 1}/${lessons.length}]`)} ${lesson.title}`);
    try {
      const synced = await publishLesson(lesson, dryRun);
      totalSynced += synced;
    } catch (e) {
      log.err(`Урок ${lesson.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log("");
  }

  cleanupRemoteTmp(dryRun);

  console.log("─".repeat(60));
  if (dryRun) {
    log.ok(`[dry-run] Будет опубликовано: ${totalSynced} медиа-файлов из ${lessons.length} уроков`);
  } else {
    log.ok(`Опубликовано: ${totalSynced} медиа-файлов из ${lessons.length} уроков`);
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
