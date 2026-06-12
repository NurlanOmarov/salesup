import { db } from "@/lib/db";
import { chunkText } from "@/lib/ai/chunk";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: нарезка транскриптов на чанки для RAG (S3.1/S7.1). Пишет TranscriptChunk
 * (text, lessonId, courseId, seq). Поиск — полнотекстовый Postgres (lib/ai/rag);
 * векторные эмбеддинги (Voyage) подключатся позже без смены интерфейса.
 *   pnpm factory:chunk --course <slug>
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const courseSlug = typeof args.options.course === "string" ? args.options.course : null;
  if (!courseSlug) throw new Error("Укажите --course <slug>");

  const course = await db.course.findUnique({ where: { slug: courseSlug }, select: { id: true } });
  if (!course) throw new Error(`Курс ${courseSlug} не найден`);

  const transcripts = await db.transcript.findMany({
    where: { status: "CLEANED", lesson: { module: { courseId: course.id } } },
    select: { id: true, cleanText: true, lessonId: true, lesson: { select: { title: true } } },
  });

  let total = 0;
  for (const t of transcripts) {
    if (!t.cleanText) continue;
    const chunks = chunkText(t.cleanText);
    // Идемпотентность: пересоздаём чанки урока.
    await db.transcriptChunk.deleteMany({ where: { lessonId: t.lessonId } });
    for (const ch of chunks) {
      await db.transcriptChunk.create({
        data: {
          transcriptId: t.id,
          lessonId: t.lessonId,
          courseId: course.id,
          seq: ch.seq,
          text: ch.text,
          startSec: 0,
          endSec: 0,
        },
      });
    }
    total += chunks.length;
    log.ok(`«${t.lesson.title}»: ${chunks.length} чанков`);
  }

  console.log(`\n${c.bold("── Отчёт ──")}`);
  log.info(`Чанков создано: ${total} из ${transcripts.length} транскриптов`);
  await db.$disconnect();
}

main().catch(async (e) => {
  log.err(e instanceof Error ? e.message : String(e));
  await db.$disconnect();
  process.exit(1);
});
