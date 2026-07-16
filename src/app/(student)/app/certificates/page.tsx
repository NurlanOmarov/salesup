import type { Metadata } from "next";
import { Award, Mail, Clock, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CERTIFICATE_REQUEST_EMAIL } from "@/lib/certificates/constants";

export const metadata: Metadata = {
  title: "Мои сертификаты",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await requireUser();

  const certs = await db.certificate.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: [{ status: "asc" }, { readyAt: "desc" }],
    select: {
      id: true,
      status: true,
      scorePct: true,
      readyAt: true,
      issuedAt: true,
      course: { select: { title: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Мои сертификаты</h1>

      {certs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <Award className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">Сертификатов пока нет</p>
          <p className="mt-1 text-sm text-foreground/60">
            Пройдите все уроки курса и сдайте итоговый экзамен — курс будет отмечен как
            готовый к получению сертификата.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {certs.map((c) => {
            const issued = c.status === "ISSUED";
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-foreground/10 bg-background p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <Award className="size-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{c.course.title}</p>
                      <p className="text-sm text-foreground/60">
                        {issued
                          ? `Выдан ${c.issuedAt?.toLocaleDateString("ru-RU") ?? ""}`
                          : `Готов к получению · ${c.readyAt.toLocaleDateString("ru-RU")}`}
                        {c.scorePct != null ? ` · ${c.scorePct}%` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      issued
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {issued ? (
                      <>
                        <CheckCircle2 className="size-3.5" /> Выдан
                      </>
                    ) : (
                      <>
                        <Clock className="size-3.5" /> Готов к получению
                      </>
                    )}
                  </span>
                </div>

                {!issued ? (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm">
                    <Mail className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-foreground/80">
                      Для получения сертификата отправьте ваше ФИО на почту{" "}
                      <a
                        href={`mailto:${CERTIFICATE_REQUEST_EMAIL}?subject=${encodeURIComponent(
                          `Сертификат: ${c.course.title}`,
                        )}`}
                        className="font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400"
                      >
                        {CERTIFICATE_REQUEST_EMAIL}
                      </a>
                      . Мы подготовим сертификат и вышлем его вам.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
