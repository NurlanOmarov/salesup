import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { embedDocuments, toVectorLiteral } from "@/lib/ai/embeddings.js";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: генерация векторных эмбеддингов (Voyage voyage-3, 1024 изм. — D-001) для чанков
 * транскриптов, у которых embedding ещё не заполнен. Идемпотентно: обрабатывает только
 * NULL-эмбеддинги, поэтому безопасно перезапускать.
 *
 *   pnpm factory:embed --course <slug>     # только указанный курс
 *   pnpm factory:embed --all               # все курсы
 *   --batch <n>   размер батча (по умолчанию 4 — под free tier Voyage 10K TPM)
 *   --delay <ms>  пауза между запросами (по умолчанию 21000 — под free tier 3 RPM)
 *
 * Free tier Voyage без карты: 3 запроса/мин и 10K токенов/мин. Дефолты под него.
 * С привязанной картой можно ускорить: --batch 64 --delay 0.
 *
 * На сервере (worker-контейнер, ключ Voyage уже в env):
 *   docker compose -f docker-compose.prod.yml --env-file .env \
 *     run --rm worker pnpm tsx scripts/factory/embed.ts --course <slug>
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  const all = args.options.all === true;
  const batchSize = typeof args.options.batch === "string" ? Math.max(1, parseInt(args.options.batch, 10)) : 4;
  const delayMs = typeof args.options.delay === "string" ? Math.max(0, parseInt(args.options.delay, 10)) : 21000;

  if (!courseSlug && !all) {
    throw new Error("Укажите --course <slug> или --all");
  }

  let courseFilter = Prisma.empty;
  if (courseSlug) {
    const course = await db.course.findUnique({ where: { slug: courseSlug }, select: { id: true } });
    if (!course) throw new Error(`Курс ${courseSlug} не найден`);
    courseFilter = Prisma.sql`AND "courseId" = ${course.id}`;
  }

  const rows = await db.$queryRaw<{ id: string; text: string }[]>(Prisma.sql`
    SELECT id, text FROM "TranscriptChunk"
    WHERE embedding IS NULL ${courseFilter}
    ORDER BY "courseId", seq
  `);

  if (rows.length === 0) {
    log.ok("Все чанки уже векторизованы — нечего делать.");
    await db.$disconnect();
    return;
  }

  log.step(`Векторизую ${rows.length} чанков (Voyage voyage-3, батч ${batchSize}, пауза ${delayMs}мс)…`);

  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    // Ретрай на 429 (rate limit free tier): ждём минуту и пробуем снова.
    let vectors: number[][] | null = null;
    for (let attempt = 1; attempt <= 6 && !vectors; attempt++) {
      try {
        vectors = await embedDocuments(batch.map((r) => r.text), batchSize);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("429") && attempt < 6) {
          log.warn(`429 (rate limit) — жду 65с и повторяю (попытка ${attempt})…`);
          await sleep(65000);
        } else {
          throw e;
        }
      }
    }
    if (!vectors) throw new Error("Не удалось получить эмбеддинги после ретраев");

    // Запись вектора — через raw (тип vector в Prisma — Unsupported).
    for (let j = 0; j < batch.length; j++) {
      const vec = vectors[j];
      if (!vec) continue;
      await db.$executeRaw(Prisma.sql`
        UPDATE "TranscriptChunk" SET embedding = ${toVectorLiteral(vec)}::vector WHERE id = ${batch[j]!.id}
      `);
    }
    done += batch.length;
    log.info(`${done}/${rows.length}`);

    if (delayMs > 0 && i + batchSize < rows.length) await sleep(delayMs);
  }

  console.log(`\n${c.bold("── Отчёт ──")}`);
  log.ok(`Векторизовано чанков: ${done}`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
