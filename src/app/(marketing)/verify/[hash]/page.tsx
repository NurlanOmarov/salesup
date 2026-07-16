import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Проверка сертификата",
  // Служебная страница — вне индекса (CLAUDE.md, правило 9). ФИО здесь не показывается.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Публичная страница проверки подлинности сертификата. Доступна без входа. По verifyHash
 * подтверждает факт и параметры выдачи (курс, номер, дата) — БЕЗ ФИО (ПДн не хранятся,
 * правило 9). Работает только для выданных сертификатов, которым владелец присвоил hash.
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  const cert = await db.certificate.findUnique({
    where: { verifyHash: hash },
    select: {
      number: true,
      scorePct: true,
      hoursLabel: true,
      status: true,
      issuedAt: true,
      revokedAt: true,
      course: { select: { title: true } },
    },
  });

  const valid = cert && !cert.revokedAt && cert.status === "ISSUED";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      {valid ? (
        <>
          <CheckCircle2 className="size-16 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold">Сертификат подлинный</h1>
          <div className="mt-6 w-full rounded-2xl border border-foreground/10 bg-background p-6 text-left">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-foreground/50">Курс</dt>
                <dd className="font-medium">{cert!.course.title}</dd>
              </div>
              <div className="flex gap-8">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-foreground/50">Номер</dt>
                  <dd>{cert!.number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-foreground/50">Дата</dt>
                  <dd>{cert!.issuedAt?.toLocaleDateString("ru-RU") ?? "—"}</dd>
                </div>
                {cert!.scorePct != null ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-foreground/50">Балл</dt>
                    <dd>{cert!.scorePct}%</dd>
                  </div>
                ) : null}
              </div>
            </dl>
          </div>
          <p className="mt-4 text-xs text-foreground/40">
            Выдан платформой ACTIVE SALES
          </p>
        </>
      ) : (
        <>
          <XCircle className="size-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-bold">
            {cert?.revokedAt ? "Сертификат отозван" : "Сертификат не найден"}
          </h1>
          <p className="mt-2 text-foreground/60">
            {cert?.revokedAt
              ? "Этот сертификат был аннулирован и более не действителен."
              : "Сертификат с таким идентификатором не существует. Проверьте ссылку или QR-код."}
          </p>
        </>
      )}
    </main>
  );
}
