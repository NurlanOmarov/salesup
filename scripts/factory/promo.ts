import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, requireOption } from "./lib/args.js";
import { c, log, humanSize } from "./lib/log.js";
import {
  requireDeployHost,
  rsyncFile,
  dockerCpToContainer,
  cleanupRemoteTmp,
} from "./lib/prod.js";

/**
 * CLI: выкладка своих промо-роликов курса на прод — тех, которых нет на YouTube
 * (рилсы, присланные файлом). Витрина играет их из каталога promo курса
 * (lib/courses/promo-video.ts, раздача /api/promo → nginx).
 *
 *   pnpm factory:promo --course <slug> --dir <каталог> [--dry-run]
 *
 * В каталоге — пары <имя>.mp4 + <имя>.jpg (имя: латиница, цифры, дефис).
 * Ролик готовим заранее, лёгким — это витрина, а не урок (правило 10):
 *   ffmpeg -i src.mp4 -vf "scale=720:1280:flags=lanczos,format=yuv420p" \
 *     -c:v libx264 -preset slow -crf 25 -maxrate 2500k -bufsize 5000k \
 *     -c:a aac -b:a 96k -movflags +faststart reel-1.mp4
 *   ffmpeg -ss <секунда с удачным кадром> -i reel-1.mp4 -frames:v 1 -q:v 4 reel-1.jpg
 *
 * БД не трогает: список роликов — в Course.promoVideos (prisma/seed.ts), куда
 * вписываются элементы { file: "courses/<slug>/promo/<имя>.mp4", vertical, title }.
 */

const NAME_RE = /^[a-z0-9-]{1,40}$/;
const SLUG_RE = /^[a-z0-9-]+$/;
const MAX_BYTES = 20 * 1024 * 1024;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const usage = "factory:promo --course <slug> --dir <каталог>";
  const slug = requireOption(args, "course", usage);
  const dir = requireOption(args, "dir", usage);
  const dryRun = args.options["dry-run"] === true;
  if (!SLUG_RE.test(slug)) throw new Error(`Некорректный slug: ${slug}`);
  if (!existsSync(dir)) throw new Error(`Нет каталога ${dir}`);
  requireDeployHost();

  const names = readdirSync(dir)
    .filter((f) => f.endsWith(".mp4"))
    .map((f) => f.slice(0, -4))
    .sort();
  if (names.length === 0) throw new Error(`В ${dir} нет .mp4`);

  for (const name of names) {
    if (!NAME_RE.test(name)) throw new Error(`Имя «${name}» — только латиница, цифры и дефис`);
    if (!existsSync(join(dir, `${name}.jpg`))) throw new Error(`Нет превью ${name}.jpg`);
    const size = statSync(join(dir, `${name}.mp4`)).size;
    if (size > MAX_BYTES) {
      throw new Error(`${name}.mp4 — ${humanSize(size)}: для промо это много, пережмите`);
    }
  }

  let bytes = 0;
  for (const name of names) {
    for (const ext of ["mp4", "jpg"]) {
      const key = `courses/${slug}/promo/${name}.${ext}`;
      const local = join(dir, `${name}.${ext}`);
      bytes += statSync(local).size;
      const remoteTmp = rsyncFile(local, key, dryRun);
      dockerCpToContainer(remoteTmp, key, dryRun);
    }
  }
  cleanupRemoteTmp(dryRun);

  console.log(`\n${c.bold("── Отчёт ──")}`);
  log.info(`Роликов: ${names.length}, объём ${humanSize(bytes)}`);
  log.info("Для Course.promoVideos:");
  for (const name of names) {
    console.log(`  { file: "courses/${slug}/promo/${name}.mp4", vertical: true, title: "…" },`);
  }
}

try {
  main();
} catch (e) {
  log.err(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
