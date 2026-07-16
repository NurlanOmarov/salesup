import { notFound, permanentRedirect } from "next/navigation";
import { resolveRedirect, recordNotFound } from "@/lib/seo/redirects";

export const dynamic = "force-dynamic";

/**
 * Catch-all несуществующих публичных путей: 1) если владелец завёл редирект — 308
 * (site-wide перенаправления, не только /courses/*); 2) иначе путь пишется в журнал
 * 404 (админка «Редиректы») и отдаётся стандартный not-found.
 */
export default async function MarketingCatchAll({
  params,
}: {
  params: Promise<{ nf: string[] }>;
}) {
  const { nf } = await params;
  const path = "/" + nf.map(decodeURIComponent).join("/");

  const to = await resolveRedirect(path);
  if (to) permanentRedirect(to);

  await recordNotFound(path);
  notFound();
}
