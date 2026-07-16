"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Radar, CheckCircle2, AlertTriangle } from "lucide-react";
import { analyzeCannibalizationAction } from "./actions";
import type { CannibalReport } from "@/lib/seo/semantic";

export function CannibalizationWidget() {
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<CannibalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setPending(true);
    const res = await analyzeCannibalizationAction();
    setPending(false);
    if (res.ok) setReport(res.data);
    else setError(res.error);
  }

  return (
    <div className="mt-3 rounded-2xl border border-foreground/10 bg-background p-4">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Radar className="size-3.5" />
        )}
        Проанализировать
      </button>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {report ? (
        report.courseCount < 2 ? (
          <p className="mt-3 text-sm text-foreground/60">
            Опубликован {report.courseCount} курс — сравнивать не с чем.
          </p>
        ) : report.pairs.length === 0 ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" />
            Пересечений нет: {report.courseCount} курсов не конкурируют за один запрос.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-foreground/50">
              Похожие метаданные — курсы могут конкурировать в выдаче. Разведите
              фокус-ключи и заголовки.
            </p>
            {report.pairs.map((p, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-sm"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                <Link
                  href={`/courses/${p.a.slug}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {p.a.title}
                </Link>
                <span className="text-foreground/40">↔</span>
                <Link
                  href={`/courses/${p.b.slug}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {p.b.title}
                </Link>
                <span className="ml-auto tabular-nums text-xs text-foreground/50">
                  {Math.round(p.similarity * 100)}% близость
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
