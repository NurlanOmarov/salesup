import { writeFile, readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { translateCourseCard } from "@/lib/ai/translate";
import { parseArgs } from "./lib/args.js";
import { c, log } from "./lib/log.js";

/**
 * CLI: переводы карточек курсов для витрин на казахском и узбекском.
 *
 * Переводится ТОЛЬКО витрина — название, подзаголовок, описание. Видео, конспекты
 * и тесты остаются русскими, и карточка сообщает об этом явно, поэтому перевод
 * названия не обещает урок на другом языке.
 *
 * Два режима, как у субтитров (см. factory:subs): по умолчанию — экспорт/импорт,
 * чтобы перевод делал оператор, с --api — через Haiku.
 *
 *   pnpm factory:course-i18n --export ru.json [--course <slug>]   # выгрузить русские тексты
 *   pnpm factory:course-i18n --import kk.json --lang kk           # загрузить переводы
 *   pnpm factory:course-i18n --lang kk,uz --api [--course <slug>] # перевести через Haiku
 *   pnpm factory:course-i18n --status                             # что уже переведено
 *
 * Формат файла перевода: { "<slug>": { "title": "...", "subtitle": "...", "description": "..." } }
 */

type Card = { title: string; subtitle: string | null; description: string };

async function courses(slug?: string) {
  return db.course.findMany({
    where: { status: "PUBLISHED", ...(slug ? { slug } : {}) },
    select: { id: true, slug: true, title: true, subtitle: true, description: true },
    orderBy: { slug: "asc" },
  });
}

async function save(courseId: string, locale: string, card: Card) {
  await db.courseTranslation.upsert({
    where: { courseId_locale: { courseId, locale } },
    create: { courseId, locale, ...card },
    update: card,
  });
}

async function main() {
  const { options } = parseArgs(process.argv.slice(2));
  const slug = typeof options.course === "string" ? options.course : undefined;
  const langs = String(options.lang ?? "")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l === "kk" || l === "uz");

  if (options.status) {
    const rows = await db.courseTranslation.findMany({
      select: { locale: true, course: { select: { slug: true } } },
    });
    const all = await courses();
    for (const course of all) {
      const has = rows.filter((r) => r.course.slug === course.slug).map((r) => r.locale);
      log.info(`${course.slug.padEnd(18)} ${has.length ? c.green(has.join(", ")) : c.dim("нет переводов")}`);
    }
    return;
  }

  if (typeof options.export === "string") {
    const rows = await courses(slug);
    const out: Record<string, Card> = {};
    for (const r of rows) {
      out[r.slug] = { title: r.title, subtitle: r.subtitle, description: r.description };
    }
    await writeFile(options.export, JSON.stringify(out, null, 2), "utf8");
    log.ok(`Выгружено карточек: ${rows.length} → ${options.export}`);
    log.info("Переведите значения и загрузите: --import <файл> --lang kk");
    return;
  }

  if (typeof options.import === "string") {
    const [locale] = langs;
    if (!locale) throw new Error("Укажите --lang kk|uz");
    const data = JSON.parse(await readFile(options.import, "utf8")) as Record<string, Card>;
    const rows = await courses();
    let saved = 0;
    for (const [slugKey, card] of Object.entries(data)) {
      const course = rows.find((r) => r.slug === slugKey);
      if (!course) {
        log.warn(`пропущен неизвестный курс: ${slugKey}`);
        continue;
      }
      await save(course.id, locale, {
        title: card.title,
        subtitle: card.subtitle ?? null,
        description: card.description,
      });
      saved++;
    }
    log.ok(`Сохранено переводов (${locale}): ${saved}`);
    return;
  }

  if (!langs.length) throw new Error("Укажите --lang kk,uz (или --export / --import / --status)");
  if (!options.api) {
    throw new Error(
      "Без --api перевод не выполняется: выгрузите тексты (--export) и переведите их, " +
        "либо повторите с --api, чтобы перевести через Haiku.",
    );
  }

  const rows = await courses(slug);
  for (const course of rows) {
    for (const locale of langs) {
      const target = locale === "kk" ? "KK" : "UZ";
      const card = await translateCourseCard(
        { title: course.title, subtitle: course.subtitle, description: course.description },
        target,
      );
      await save(course.id, locale, card);
      log.ok(`${course.slug} → ${locale}: ${card.title}`);
    }
  }
}

main()
  .catch((e) => {
    log.err(String(e instanceof Error ? e.message : e));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
