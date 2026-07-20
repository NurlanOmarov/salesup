import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { parseArgs } from "./lib/args.js";
import { c, log, humanSize } from "./lib/log.js";
import {
  DEPLOY_DB_CONTAINER,
  DEPLOY_DB_USER,
  DEPLOY_DB_NAME,
  DEPLOY_MEDIA_CONTAINER,
  requireDeployHost,
  sshExec,
  psqlRows,
  rsyncFile,
  cleanupRemoteTmp,
} from "./lib/prod.js";

/**
 * CLI: выкладка HLS-видео и дорожек субтитров курса на прод (дополняет factory:publish,
 * который умеет только audio/podcast/slides-pdf).
 *
 *   pnpm factory:publish-video --course sales-b2b [--dry-run]
 *
 * Зачем отдельная команда. Фабрика кодирует видео ЛОКАЛЬНО и кладёт его по ключу
 * courses/<slug>/lessons/<ЛОКАЛЬНЫЙ id>/…, а на проде у тех же уроков ДРУГИЕ id
 * (прод-БД и dev-БД сидятся независимо). Поэтому публикация — это перенос каталога
 * под прод-ключ + перенос полей урока, а не простой rsync каталога media.
 *
 * Уроки сопоставляются по названию в пределах курса; несопоставленные и неоднозначные
 * печатаются и валят запуск — автоматика не должна подложить видео не в тот урок.
 *
 * URI ключа AES внутри плейлистов переписывать НЕ нужно: приложение подменяет его на
 * лету (src/lib/video/hls-rewrite.ts) по id запрошенного урока, файлы на диске не
 * используются напрямую. А сам AES-ключ переносится как есть — он зашифрован
 * VIDEO_KEY_ENC_SECRET, и команда проверяет, что секрет на проде тот же.
 *
 * Что пишется в прод-БД (только для сопоставленных уроков):
 *   Lesson: videoKey, videoAesKeyEnc, videoStatus=READY, durationSec, status=PUBLISHED
 *   SubtitleTrack: строка на каждую локальную дорожку (RU/KK/EN/UZ)
 */

const MEDIA_ROOT = process.env.MEDIA_ROOT ?? join(process.cwd(), "media");
const SLUG_RE = /^[a-z0-9-]+$/;
const ID_RE = /^[a-z0-9]+$/;

/** Экранирование строкового литерала PostgreSQL (одинарные кавычки удваиваются). */
function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function psqlExec(sql: string, dryRun: boolean): void {
  if (dryRun) {
    log.info(`[dry-run] psql: ${c.dim(sql)}`);
    return;
  }
  sshExec(
    `docker exec ${DEPLOY_DB_CONTAINER} psql -U ${DEPLOY_DB_USER} -d ${DEPLOY_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
    true,
  );
}

/** id для строк, которые создаём в обход Prisma (cuid-совместимый вид: c + hex). */
function newId(): string {
  return "c" + [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const dryRun = args.options["dry-run"] === true;
  if (!courseSlug || !SLUG_RE.test(courseSlug)) throw new Error("Укажите --course <slug>");
  requireDeployHost();

  // ── Локальные уроки с готовым видео ────────────────────────────────────────
  const local = await db.lesson.findMany({
    where: { module: { course: { slug: courseSlug } }, videoStatus: "READY" },
    select: {
      id: true,
      title: true,
      videoKey: true,
      videoAesKeyEnc: true,
      durationSec: true,
      subtitles: { select: { lang: true, vttKey: true, origin: true, validation: true } },
    },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  if (local.length === 0) throw new Error(`У курса ${courseSlug} нет уроков с videoStatus=READY — сначала pnpm factory:video`);

  // ── Прод-уроки того же курса ───────────────────────────────────────────────
  const prodRows = psqlRows(
    `select l.id, l.title from "Lesson" l join "Module" m on m.id = l."moduleId" join "Course" c on c.id = m."courseId" where c.slug = ${sqlStr(courseSlug)};`,
  );
  const prodByTitle = new Map<string, string[]>();
  for (const [id, title] of prodRows) {
    if (!id || !title) continue;
    prodByTitle.set(title, [...(prodByTitle.get(title) ?? []), id]);
  }

  // ── Сопоставление: любая неоднозначность валит запуск ──────────────────────
  const pairs: { localId: string; prodId: string; title: string }[] = [];
  const problems: string[] = [];
  for (const l of local) {
    const found = prodByTitle.get(l.title) ?? [];
    if (found.length === 0) problems.push(`нет урока на проде: «${l.title}»`);
    else if (found.length > 1) problems.push(`на проде несколько уроков с названием «${l.title}»`);
    else if (!ID_RE.test(found[0]!)) problems.push(`подозрительный прод-id урока «${l.title}»: ${found[0]}`);
    else pairs.push({ localId: l.id, prodId: found[0]!, title: l.title });
  }
  if (problems.length > 0) {
    for (const p of problems) log.err(p);
    throw new Error("Сопоставление уроков не удалось — прод-структура курса отличается от локальной");
  }

  log.step(`Курс ${c.bold(courseSlug)}: ${pairs.length} уроков${dryRun ? c.dim(" (dry-run)") : ""}`);

  let bytes = 0;
  for (const [i, pair] of pairs.entries()) {
    const l = local.find((x) => x.id === pair.localId)!;
    log.step(`[${i + 1}/${pairs.length}] ${l.title}`);
    log.info(`${pair.localId} → ${pair.prodId}`);

    const localDir = join(MEDIA_ROOT, "courses", courseSlug, "lessons", pair.localId);
    if (!existsSync(localDir)) {
      log.err(`Нет локального каталога ${localDir}`);
      continue;
    }
    const size = localDirSize(localDir);
    bytes += size;
    log.info(`Каталог: ${humanSize(size)}`);

    // Каталог целиком: rsync во временный путь VPS, затем docker cp в том media.
    const remoteKey = `courses/${courseSlug}/lessons/${pair.prodId}`;
    const remoteTmp = rsyncFile(`${localDir}/`, `${remoteKey}/`, dryRun);
    if (!dryRun) {
      sshExec(`docker exec ${DEPLOY_MEDIA_CONTAINER} mkdir -p '/media/${remoteKey}'`, true);
      sshExec(`docker cp '${remoteTmp}/.' ${DEPLOY_MEDIA_CONTAINER}:/media/${remoteKey}`, false);
      sshExec(`docker exec ${DEPLOY_MEDIA_CONTAINER} chown -R 1000:1000 '/media/${remoteKey}'`, true);
      log.ok(`Медиа скопировано: /media/${remoteKey}`);
    } else {
      log.info(`[dry-run] docker cp → ${DEPLOY_MEDIA_CONTAINER}:/media/${remoteKey}`);
    }

    // Поля урока. videoAesKeyEnc переносим как есть — секрет шифрования общий.
    const videoKey = `courses/${courseSlug}/lessons/${pair.prodId}`;
    const enc = l.videoAesKeyEnc ?? "";
    if (!/^[A-Za-z0-9+/=:._-]*$/.test(enc)) throw new Error(`Подозрительный videoAesKeyEnc у «${l.title}»`);
    const dur = Number.isInteger(l.durationSec) ? String(l.durationSec) : "NULL";
    psqlExec(
      `UPDATE "Lesson" SET "videoKey" = ${sqlStr(videoKey)}, "videoAesKeyEnc" = ${sqlStr(enc)}, ` +
        `"videoStatus" = 'READY', "durationSec" = ${dur}, "status" = 'PUBLISHED' WHERE id = ${sqlStr(pair.prodId)};`,
      dryRun,
    );

    // Дорожки субтитров: ключ пересобираем под прод-id.
    for (const track of l.subtitles) {
      const vttKey = `courses/${courseSlug}/lessons/${pair.prodId}/subs/${track.lang.toLowerCase()}.vtt`;
      psqlExec(
        `INSERT INTO "SubtitleTrack" (id, "lessonId", lang, origin, "vttKey", validation, "createdAt") ` +
          `VALUES (${sqlStr(newId())}, ${sqlStr(pair.prodId)}, '${track.lang}', '${track.origin}', ${sqlStr(vttKey)}, '${track.validation}', now()) ` +
          `ON CONFLICT ("lessonId", lang) DO UPDATE SET "vttKey" = EXCLUDED."vttKey", origin = EXCLUDED.origin, validation = EXCLUDED.validation;`,
        dryRun,
      );
    }
    log.ok(`БД обновлена: видео + ${l.subtitles.length} дорожек субтитров`);
  }

  cleanupRemoteTmp(dryRun);

  console.log("\n── Отчёт ──");
  log.info(`Уроков опубликовано: ${pairs.length}`);
  log.info(`Объём медиа: ${humanSize(bytes)}`);
}

/** Размер локального каталога в байтах (du -sk, чтобы не обходить дерево в JS). */
function localDirSize(dir: string): number {
  const out = execFileSync("du", ["-sk", dir], { encoding: "utf-8" });
  return Number(out.split("\t")[0]) * 1024;
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    log.err(String(e instanceof Error ? e.message : e));
    await db.$disconnect();
    process.exit(1);
  });
