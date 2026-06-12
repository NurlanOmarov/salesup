import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Постановка фоновой задачи в очередь (S5.4). Обработка — в worker-контейнере.
 * Тяжёлые медиа-задачи сюда НЕ кладём (они в CLI-фабрике) — только лёгкие:
 * письма, генерация сертификата, регенерация вопроса, дайджест.
 */
export async function enqueue(
  type: string,
  payload: Prisma.InputJsonValue,
  opts: { runAfter?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const job = await db.job.create({
    data: {
      type,
      payload,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    },
    select: { id: true },
  });
  return job.id;
}
