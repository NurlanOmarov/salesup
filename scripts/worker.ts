import cron from "node-cron";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { processBatch } from "@/lib/jobs/runner";
import { enqueue } from "@/lib/jobs/enqueue";
import { currency } from "@/lib/currency";

/**
 * Worker-контейнер (S5.4): цикл обработки очереди Job + node-cron расписания.
 * Запуск: `pnpm worker` локально или отдельный сервис в docker-compose.
 * Тяжёлые медиа-задачи сюда НЕ попадают — они в CLI-фабрике.
 */

const POLL_INTERVAL_MS = 5_000;
let stopping = false;

async function pollLoop() {
  while (!stopping) {
    try {
      const n = await processBatch();
      if (n > 0) log.info({ processed: n }, "Обработана пачка задач");
    } catch (e) {
      log.error({ err: e }, "Ошибка в цикле обработки задач");
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function setupCron() {
  // Еженедельный дайджест владельцу — понедельник 09:00 (S6.2).
  cron.schedule("0 9 * * 1", () => {
    void enqueue("digest.weekly", { triggeredAt: new Date().toISOString() }).catch((e) =>
      log.error({ err: e }, "Не удалось поставить digest.weekly"),
    );
  });

  // Ежедневные проверки (диск/БД, антишаринг-эвристики) — 03:00 (S6.1/S6.3).
  cron.schedule("0 3 * * *", () => {
    void enqueue("maintenance.daily", { triggeredAt: new Date().toISOString() }).catch((e) =>
      log.error({ err: e }, "Не удалось поставить maintenance.daily"),
    );
  });

  // Ежедневные учебные напоминания ученикам — 18:00 (вечернее окно обучения).
  cron.schedule("0 18 * * *", () => {
    void enqueue("reminders.daily", { triggeredAt: new Date().toISOString() }).catch((e) =>
      log.error({ err: e }, "Не удалось поставить reminders.daily"),
    );
  });

  // Сверка оплаченных заказов магазина — 05:00. Страхует потерянный webhook:
  // человек заплатил, уведомление не дошло, доступ всё равно откроется к утру.
  cron.schedule("0 5 * * *", () => {
    void enqueue("woo.reconcile", { triggeredAt: new Date().toISOString() }).catch((e) =>
      log.error({ err: e }, "Не удалось поставить woo.reconcile"),
    );
  });

  // Ежедневное обновление курсов валют Нацбанка РК — 04:00 (для витрины в 3 валютах).
  cron.schedule("0 4 * * *", () => {
    void currency.refresh().catch((e) =>
      log.error({ err: e }, "currency.refresh (cron) упал"),
    );
  });

  log.info("Cron-расписания установлены (weekly digest, daily maintenance, daily reminders, woo reconcile, currency rates)");
}

async function main() {
  log.info("Worker запущен");
  setupCron();
  await pollLoop();
}

async function shutdown(signal: string) {
  log.info({ signal }, "Worker останавливается");
  stopping = true;
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((e) => {
  log.error({ err: e }, "Worker упал");
  process.exit(1);
});
