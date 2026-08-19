/**
 * Доступ к проду для команд фабрики (factory:publish, factory:slides-import).
 *
 * Прод — один VPS с docker compose (CLAUDE.md, принцип 2): БД в контейнере
 * DEPLOY_DB_CONTAINER, медиа — в томе, примонтированном в DEPLOY_MEDIA_CONTAINER
 * как /media. Поэтому «залить файл на прод» = rsync во временный каталог VPS +
 * `docker cp` в контейнер, а «обновить БД» = `docker exec psql`.
 *
 * Переменные окружения (.env.deploy, НЕ в git):
 *   DEPLOY_HOST             user@host
 *   DEPLOY_SSH_PORT         SSH-порт VPS (default: 22)
 *   DEPLOY_DB_CONTAINER     контейнер PostgreSQL (default: salesup-db-1)
 *   DEPLOY_MEDIA_CONTAINER  контейнер с томом media (default: salesup-worker-1)
 *   DEPLOY_DB_USER / DEPLOY_DB_NAME (default: salesacademy)
 *
 * Пароль PostgreSQL не передаётся — psql читает его из env контейнера.
 */

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { c, log } from "./log.js";

export const DEPLOY_HOST = process.env.DEPLOY_HOST ?? "";
export const DEPLOY_SSH_PORT = process.env.DEPLOY_SSH_PORT ?? "22";
export const DEPLOY_DB_CONTAINER = process.env.DEPLOY_DB_CONTAINER ?? "salesup-db-1";
export const DEPLOY_MEDIA_CONTAINER = process.env.DEPLOY_MEDIA_CONTAINER ?? "salesup-worker-1";
export const DEPLOY_DB_USER = process.env.DEPLOY_DB_USER ?? "salesacademy";
export const DEPLOY_DB_NAME = process.env.DEPLOY_DB_NAME ?? "salesacademy";

/** Медиа-поля урока, которые фабрика публикует на прод. */
export type MediaField = "audioKey" | "podcastKey" | "slidesPdfKey";

/** Бросить понятную ошибку, если .env.deploy не заполнен. */
export function requireDeployHost(): void {
  if (!DEPLOY_HOST) {
    throw new Error(
      "DEPLOY_HOST не задан. Добавьте в .env.deploy:\n" +
        "  DEPLOY_HOST=user@ip\n" +
        "  DEPLOY_SSH_PORT=22",
    );
  }
}

/** Выполнить команду на VPS по SSH, вернуть stdout. */
export function sshExec(cmd: string, silent = false): string {
  if (!silent) log.info(`ssh: ${c.dim(cmd)}`);
  return execFileSync(
    "ssh",
    ["-p", DEPLOY_SSH_PORT, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", DEPLOY_HOST, cmd],
    { encoding: "utf-8", stdio: ["inherit", "pipe", "pipe"] },
  ).trim();
}

/**
 * SELECT в прод-БД: строки в формате `-At` (колонки через `|`).
 * Только для чтения — на запись есть updateProdMediaKey (с валидацией значений).
 */
export function psqlRows(sql: string): string[][] {
  const out = sshExec(
    `docker exec ${DEPLOY_DB_CONTAINER} psql -U ${DEPLOY_DB_USER} -d ${DEPLOY_DB_NAME} -At -c "${sql.replace(/"/g, '\\"')}"`,
    true,
  );
  return out ? out.split("\n").map((line) => line.split("|")) : [];
}

/**
 * Промежуточный каталог выгрузки на VPS — свой у каждого процесса фабрики.
 * Общий путь ловил гонку: cleanupRemoteTmp одного скрипта (например slides-import)
 * сносил каталог параллельно работающего publish-video, и docker cp падал с
 * «lstat /tmp/salesup-publish: no such file or directory».
 */
/**
 * Временный каталог на VPS, куда rsync кладёт файлы перед `docker cp` в том.
 *
 * По умолчанию — свой на каждый запуск (по PID): так параллельные выкладки не
 * мешают друг другу, а мусор гарантированно убирается в конце.
 *
 * DEPLOY_REMOTE_TMP задаёт СТАБИЛЬНЫЙ путь и тем самым делает выкладку
 * возобновляемой: rsync видит уже переданные файлы и пропускает их. Это важно на
 * медленном канале — выкладка курса на ~1.6 ГБ при 100 КБ/с идёт часами, и без
 * стабильного пути любой обрыв (деплой, разрыв связи) начинал передачу с нуля.
 * Каталог удаляется после успешного завершения, как и обычный.
 */
const REMOTE_TMP = process.env.DEPLOY_REMOTE_TMP || `/tmp/salesup-publish-${process.pid}`;

/**
 * Rsync одного файла на VPS в <REMOTE_TMP>/<key>.
 * Создаёт родительские каталоги на VPS автоматически.
 * Возвращает путь к файлу на VPS.
 *
 * Примечание: без --delete (добавляет/обновляет, не трогает остальное).
 * macOS rsync (BSD) не поддерживает --no-delete; просто не передаём --delete.
 */
export function rsyncFile(localPath: string, remoteKey: string, dryRun: boolean): string {
  const remoteTmp = `${REMOTE_TMP}/${remoteKey}`;
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
export function dockerCpToContainer(remoteTmpPath: string, mediaKey: string, dryRun: boolean): void {
  const containerDest = `/media/${mediaKey}`;
  const containerDir = dirname(containerDest);

  if (dryRun) {
    log.info(`[dry-run] docker cp ${remoteTmpPath} → ${DEPLOY_MEDIA_CONTAINER}:${containerDest}`);
    return;
  }

  sshExec(`docker exec ${DEPLOY_MEDIA_CONTAINER} mkdir -p '${containerDir}'`, true);
  // docker cp не поддерживает --chown, но контейнер запущен от root и том принадлежит node (1000)
  // После cp делаем chown внутри контейнера
  sshExec(`docker cp '${remoteTmpPath}' ${DEPLOY_MEDIA_CONTAINER}:${containerDest}`, false);
  sshExec(`docker exec ${DEPLOY_MEDIA_CONTAINER} chown 1000:1000 '${containerDest}'`, true);
  log.ok(`Скопировано в контейнер: ${c.dim(containerDest)}`);
}

/**
 * UPDATE медиа-ключа урока в прод-БД через docker exec psql.
 * Значение ключа детерминировано (courses/<slug>/lessons/<id>/<file>), но перед
 * подстановкой в SQL валидируется шаблоном — инъекция невозможна.
 */
export function updateProdMediaKey(
  lessonId: string,
  field: MediaField,
  key: string,
  dryRun: boolean,
): void {
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

/** Удалить временный каталог выгрузки на VPS. */
export function cleanupRemoteTmp(dryRun: boolean): void {
  if (dryRun) return;
  try {
    sshExec(`rm -rf ${REMOTE_TMP}`, true);
  } catch {
    log.warn(`Не удалось удалить ${REMOTE_TMP} на VPS (некритично)`);
  }
}
