"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Radar, CheckCircle2, AlertTriangle, Network } from "lucide-react";
import { analyzeCannibalizationAction, keywordClustersAction } from "./actions";
import type { CannibalReport, ClusterReport } from "@/lib/seo/semantic";

export function CannibalizationWidget() {
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<CannibalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clustersPending, setClustersPending] = useState(false);
  const [clusters, setClusters] = useState<ClusterReport | null>(null);

  async function run() {
    setError(null);
    setPending(true);
    const res = await analyzeCannibalizationAction();
    setPending(false);
    if (res.ok) setReport(res.data);
    else setError(res.error);
  }

  async function runClusters() {
    setError(null);
    setClustersPending(true);
    const res = await keywordClustersAction();
    setClustersPending(false);
    if (res.ok) setClusters(res.data);
    else setError(res.error);
  }

  return (
    <div className="mt-3 rounded-2xl border border-foreground/10 bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
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
          Каннибализация
        </button>
        <button
          type="button"
          onClick={runClusters}
          disabled={clustersPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-50"
        >
          {clustersPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Network className="size-3.5" />
          )}
          Карта тем
        </button>
      </div>

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

      {/* Карта тем: кластеры смысловых тем по фокус-ключам */}
      {clusters ? (
        <div className="mt-4 space-y-3 border-t border-foreground/10 pt-3">
          {clusters.clusters.length === 0 && clusters.singles.length === 0 ? (
            <p className="text-sm text-foreground/60">Нет опубликованных курсов.</p>
          ) : (
            <>
              {clusters.clusters.map((cl, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/[0.03] p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
                    Общая тема — курсы конкурируют, разведите ключи
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {cl.courses.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline gap-2">
                        <Link
                          href={`/courses/${c.slug}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {c.title}
                        </Link>
                        <span className="text-xs text-foreground/50">
                          {c.focusKeyword ? `ключ: «${c.focusKeyword}»` : "без фокус-ключа"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {clusters.singles.length > 0 ? (
                <div className="rounded-lg border border-foreground/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                    Уникальные темы — покрытие без пересечений
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {clusters.singles.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{c.title}</span>
                        <span className="text-xs text-foreground/50">
                          {c.focusKeyword ? `ключ: «${c.focusKeyword}»` : "без фокус-ключа"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {clusters.noKeyword.length > 0 ? (
                <p className="text-xs text-foreground/50">
                  ⚠ Без фокус-ключа ({clusters.noKeyword.length}):{" "}
                  {clusters.noKeyword.map((c) => c.title).join(", ")} — для них тема
                  определена по названию. Задайте ключи в карточках курсов.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
