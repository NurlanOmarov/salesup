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
    holderName: "Иванов Иван Иванович",
    orgName: "ООО «Образец»",
    verb: "прошёл",
    lead: "бизнес-курс онлайн",
    courseTitle: "Эффективные продажи в DIY",
    number: "5000/22.09.2026",
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
