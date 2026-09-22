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
 * Сертификаты (D-019). Выдача автоматическая: ученик прошёл курс → «Готов к
 * получению» → оставил отзыв → ввёл ФИО с согласием → PDF выпущен и ушёл на почту
 * (ответственному представителю организации или самому ученику). Владелец здесь
 * только видит картину; ручная отметка «Выдан» осталась для документов,
 * изготовленных вне системы.
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
      holderName: true,
      pdfKey: true,
      emailedAt: true,
      emailedTo: true,
      course: { select: { title: true } },
      user: { select: { email: true, login: true } },
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
            Сертификаты выдаются автоматически: ученик оставляет отзыв, вводит ФИО с
            согласием на обработку — PDF выпускается сразу и уходит на почту (работникам
            компаний — ответственному представителю). «Готовы к получению» — прошли курс,
            но ещё не ввели ФИО.
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
          Готовы к получению ({ready.length})
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
                    {c.user.email ?? c.user.login} · готов {c.readyAt.toLocaleDateString("ru-RU")}
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
                  <th className="px-4 py-2 font-medium">ФИО</th>
                  <th className="px-4 py-2 font-medium">Ученик</th>
                  <th className="px-4 py-2 font-medium">Номер</th>
                  <th className="px-4 py-2 font-medium">Выдан</th>
                  <th className="px-4 py-2 font-medium">Письмо</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {issued.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5">{c.course.title}</td>
                    <td className="px-4 py-2.5">{c.holderName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-foreground/60">{c.user.email ?? c.user.login}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {c.pdfKey ? (
                        <a href={`/api/certificate/${c.id}`} target="_blank" rel="noopener" className="text-amber-700 hover:underline">
                          {c.number ?? "PDF"}
                        </a>
                      ) : (
                        (c.number ?? "—")
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-foreground/60">
                      {c.issuedAt?.toLocaleDateString("ru-RU") ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground/60">
                      {c.emailedAt ? `${c.emailedTo ?? ""} · ${c.emailedAt.toLocaleDateString("ru-RU")}` : c.pdfKey ? "не отправлено" : "—"}
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
