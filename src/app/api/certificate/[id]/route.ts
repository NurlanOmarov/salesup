import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Скачивание PDF сертификата (S5.3). Доступ: владелец сертификата или OWNER.
 * Публичная проверка подлинности — отдельно через /verify/<hash> (без PDF).
 * Встраивается в iframe на странице сертификатов — поэтому ответ same-origin.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const cert = await db.certificate.findUnique({
    where: { id },
    select: { userId: true, pdfKey: true, number: true, revokedAt: true },
  });
  if (!cert || !cert.pdfKey) return new NextResponse("Not found", { status: 404 });
  if (cert.revokedAt) return new NextResponse("Сертификат отозван", { status: 410 });

  // Только владелец или OWNER
  if (cert.userId !== userId && session.user.role !== "OWNER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!(await storage.exists(cert.pdfKey))) {
    return new NextResponse("PDF not found", { status: 404 });
  }
  const pdf = await storage.get(cert.pdfKey);
  // ?download=1 — кнопка «Скачать PDF»; без параметра — встроенный просмотрщик.
  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = `certificate-${(cert.number ?? id).replace(/[^\w-]+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
