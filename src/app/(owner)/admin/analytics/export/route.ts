import { requireOwner } from "@/lib/auth/guards";
import { getDashboard, getSiteBreakdown } from "@/lib/analytics/dashboard";
import { resolveRange } from "@/lib/analytics/range";
import { resolveSite } from "@/lib/analytics/site-filter";
import { buildXlsx } from "@/lib/analytics/export/xlsx";
import { buildPdf } from "@/lib/analytics/export/pdf";

// pdf-lib / exceljs / fs — только Node-рантайм.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Выгрузка отчёта дашборда: /admin/analytics/export?format=xlsx|pdf&range=…&compare=… */
export async function GET(request: Request) {
  await requireOwner();

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const { from, to, compare } = await resolveRange((k) => url.searchParams.get(k));
  const { site, label: siteLabel } = resolveSite((k) => url.searchParams.get(k));
  const dashboard = await getDashboard(from, to, compare, site);
  const breakdown = site === null ? await getSiteBreakdown(from, to) : null;

  const stamp = `${site ?? "all"}_${dashboard.range.from}_${dashboard.range.to}`;

  if (format === "pdf") {
    const bytes = await buildPdf(dashboard, siteLabel, breakdown);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="analytics_${stamp}.pdf"`,
        "cache-control": "no-store",
      },
    });
  }

  const buffer = await buildXlsx(dashboard, siteLabel, breakdown);
  return new Response(buffer as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="analytics_${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
