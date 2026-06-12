import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { env } from "@/env";

export const metadata: Metadata = {
  title: "Мои сертификаты",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await requireUser();

  const certs = await db.certificate.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      number: true,
      holderName: true,
      scorePct: true,
      issuedAt: true,
      verifyHash: true,
      course: { select: { title: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои сертификаты</h1>
        <Link href="/app" className="text-sm text-foreground/60 hover:text-foreground">
          ← Моё обучение
        </Link>
      </div>

      {certs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <Award className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">Сертификатов пока нет</p>
          <p className="mt-1 text-sm text-foreground/60">
            Пройдите все уроки курса и сдайте итоговый экзамен — сертификат
            сформируется автоматически.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {certs.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-background p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Award className="size-6" />
                </div>
                <div>
                  <p className="font-semibold">{c.course.title}</p>
                  <p className="text-sm text-foreground/60">
                    № {c.number} · выдан {c.issuedAt.toLocaleDateString("ru-RU")}
                    {c.scorePct != null ? ` · ${c.scorePct}%` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/certificate/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
                >
                  <Download className="size-4" />
                  Скачать PDF
                </a>
                <a
                  href={`${env.NEXT_PUBLIC_SITE_URL}/verify/${c.verifyHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
                >
                  <ExternalLink className="size-4" />
                  Проверка
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
