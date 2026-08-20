import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, countryFromIp } from "@/lib/analytics/geo";
import { recordPageView } from "@/lib/analytics/collect";
import { currentSite, isOwnHost } from "@/lib/seo/site";

// geoip-lite — нативная работа с файлами баз, только Node-рантайм (не edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Тело маячка от pageview-tracker. path — pathname без query; v — анонимный id. */
const bodySchema = z.object({
  path: z
    .string()
    .startsWith("/")
    .max(512)
    // Обрезаем возможный query/hash — храним только чистый путь (правило 9).
    .transform((p) => p.split(/[?#]/)[0]!),
  v: z.string().min(1).max(64),
  ref: z.string().max(2048).optional().nullable(),
});

/** slug курса из /courses/<slug> (без вложенных путей) — иначе null. */
function courseSlug(path: string): string | null {
  const m = /^\/courses\/([a-z0-9-]+)\/?$/.exec(path);
  return m ? m[1]! : null;
}

/** Хост внешнего реферера; наши домены (все три ccTLD) и мусор отбрасываем. */
function externalRefHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const host = new URL(ref).host;
    if (!host || isOwnHost(host)) return null;
    return host.slice(0, 128);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // Любая ошибка сбора аналитики не должна ломать клиент — всегда отвечаем 204.
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return new NextResponse(null, { status: 204 });

    const { path, v, ref } = parsed.data;
    const [country, site] = await Promise.all([countryFromIp(clientIp(request.headers)), currentSite()]);

    await recordPageView({
      path,
      visitorId: v,
      country,
      ref: externalRefHost(ref),
      slug: courseSlug(path),
      site: site?.code ?? null,
    });
  } catch {
    // проглатываем — аналитика не критична
  }
  return new NextResponse(null, { status: 204 });
}
