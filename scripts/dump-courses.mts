import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const cs = await p.course.findMany({
  orderBy: { slug: "asc" },
  select: {
    slug: true, title: true, subtitle: true, audience: true, status: true, priceTiyn: true,
    oldPriceTiyn: true, accessDuration: true,
    modules: { select: { lessons: { select: { durationSec: true } } } },
  },
});
for (const c of cs) {
  const secs = c.modules.flatMap((m) => m.lessons).reduce((s, l) => s + (l.durationSec ?? 0), 0);
  console.log([
    c.slug, c.status, c.audience, c.accessDuration,
    (c.priceTiyn / 100).toFixed(0) + " BYN",
    Math.round(secs / 60) + " мин",
    c.title,
  ].join(" | "));
}
console.log("ИТОГО:", cs.length);
await p.$disconnect();
