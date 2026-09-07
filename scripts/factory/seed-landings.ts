/**
 * Заливка стартового набора SEO-посадочных (src/content/seo-landings.ts).
 *
 *   pnpm factory:seed-landings            # создать недостающие страницы (черновики)
 *   pnpm factory:seed-landings --publish  # сразу опубликовать созданные
 *   pnpm factory:seed-landings --force    # перезаписать тексты существующих
 *
 * По умолчанию скрипт НЕ трогает страницы, которые уже есть: их мог править
 * владелец в /admin/seo/landings, и потерять правки при повторном запуске хуже,
 * чем недозалить страницу.
 */
import { PrismaClient } from "@prisma/client";
import { SEO_LANDING_SEEDS } from "../../src/content/seo-landings";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const publish = args.includes("--publish");

  const courseSlugs = [
    ...new Set(SEO_LANDING_SEEDS.map((s) => s.courseSlug).filter((s): s is string => Boolean(s))),
  ];
  const courses = await db.course.findMany({
    where: { slug: { in: courseSlugs } },
    select: { id: true, slug: true },
  });
  const courseIdBySlug = new Map(courses.map((c) => [c.slug, c.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of SEO_LANDING_SEEDS) {
    const existing = await db.seoLanding.findUnique({ where: { slug: seed.slug } });
    if (existing && !force) {
      skipped += 1;
      console.log(`= ${seed.slug} — уже есть, пропускаем`);
      continue;
    }
    if (seed.courseSlug && !courseIdBySlug.has(seed.courseSlug)) {
      console.warn(`! ${seed.slug} — курс ${seed.courseSlug} не найден, ведём на каталог`);
    }
    const data = {
      cluster: seed.cluster,
      title: seed.title,
      description: seed.description,
      h1: seed.h1,
      intro: seed.intro,
      body: seed.body,
      courseId: seed.courseSlug ? (courseIdBySlug.get(seed.courseSlug) ?? null) : null,
      keywords: seed.keywords,
      faq: seed.faq,
      sortOrder: seed.sortOrder,
    };
    if (existing) {
      await db.seoLanding.update({ where: { slug: seed.slug }, data });
      updated += 1;
      console.log(`~ ${seed.slug} — обновлено`);
    } else {
      await db.seoLanding.create({
        data: { slug: seed.slug, published: publish, ...data },
      });
      created += 1;
      console.log(`+ ${seed.slug} — создано${publish ? " и опубликовано" : " (черновик)"}`);
    }
  }

  console.log(`\nГотово: создано ${created}, обновлено ${updated}, пропущено ${skipped}.`);
  if (!publish && created > 0) {
    console.log("Страницы созданы черновиками — проверьте тексты в /admin/seo/landings и включите «Опубликована».");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
