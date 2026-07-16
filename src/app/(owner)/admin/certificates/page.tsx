import type { Metadata } from "next";
import { Award, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { IssueButton } from "./issue-button";

export const metadata: Metadata = {
  title: "Сертификаты",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Управление выдачей сертификатов. Ученик, выполнивший условия, попадает в «Готовы к
 * выдаче» и отправляет ФИО на почту; владелец изготавливает документ вне системы и
 * помечает «Выдан». ФИО в системе не хранится (правило 9, минимизация ПДн).
 */
export default async function AdminCertificatesPage() {
  const certs = await db.certificate.findMany({
    where: { revokedAt: null },
    orderBy: [{ status: "asc" }, { readyAt: "desc" }],
    select: {
      id: true,
      status: true,
      number: true,
      scorePct: true,
      readyAt: true,
      issuedAt: true,
      course: { select: { title: true } },
      user: { select: { email: true } },
    },
  });

  const ready = certs.filter((c) => c.status === "READY");
  const issued = certs.filter((c) => c.status === "ISSUED");

  return (
    <main>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Award className="size-6 text-amber-500" />
            Сертификаты
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/60">
            Сертификаты не формируются автоматически и ФИО не хранится. Ученик,
            прошедший курс, отправляет ФИО на почту; изготовьте документ и отметьте
            «Выдан».
          </p>
        </div>
        <a
          href="/admin/certificates/preview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          <ExternalLink className="size-4" />
          Образец шаблона
        </a>
      </header>

      {/* Готовы к выдаче */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-600">
          <Clock className="size-4" />
          Готовы к выдаче ({ready.length})
        </h2>
        {ready.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50">
            Нет учеников, ожидающих выдачи.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {ready.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.03] p-4"
              >
                <div>
                  <p className="font-semibold">{c.course.title}</p>
                  <p className="text-sm text-foreground/60">
                    {c.user.email} · готов {c.readyAt.toLocaleDateString("ru-RU")}
                    {c.scorePct != null ? ` · ${c.scorePct}%` : ""}
                  </p>
                </div>
                <IssueButton id={c.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Выданные */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <CheckCircle2 className="size-4" />
          Выданные ({issued.length})
        </h2>
        {issued.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50">
            Пока ничего не выдано.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Курс</th>
                  <th className="px-4 py-2 font-medium">Ученик</th>
                  <th className="px-4 py-2 font-medium">Номер</th>
                  <th className="px-4 py-2 font-medium">Выдан</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {issued.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5">{c.course.title}</td>
                    <td className="px-4 py-2.5 text-foreground/60">{c.user.email}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-foreground/60">
                      {c.issuedAt?.toLocaleDateString("ru-RU") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
