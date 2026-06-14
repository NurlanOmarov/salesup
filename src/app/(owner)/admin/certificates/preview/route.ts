import { requireOwner } from "@/lib/auth/guards";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { env } from "@/env";

/**
 * Образец сертификата для админки: тот же рендер, что получает ученик после курса
 * (lib/certificates/pdf), но с заглушечными данными. Route-хендлеры не оборачиваются
 * layout-ом, поэтому проверку роли OWNER делаем здесь явно.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  await requireOwner();

  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const pdf = await renderCertificatePdf({
    holderName: "Иван Иванов",
    courseTitle: "Продажи в фарме: переговоры с врачом",
    number: "SA-2026-000123",
    hoursLabel: "8 часов",
    scorePct: 92,
    issuedAt: new Date(),
    verifyUrl: `${base}/verify/sample`,
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="certificate-sample.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
