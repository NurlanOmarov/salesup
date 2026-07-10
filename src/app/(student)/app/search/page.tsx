import type { Metadata } from "next";
import Link from "next/link";
import { Search, Clock, FileSearch } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { searchLessons } from "@/lib/learn/search";
import { formatTimecode } from "@/lib/learn/format";

export const metadata: Metadata = {
  title: "Поиск по материалам",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await requireUser();
  const q = ((await searchParams)?.q ?? "").trim();
  const hits = q.length >= 2 ? await searchLessons(session.user.id, q) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Search className="size-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Поиск по материалам</h1>
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        Найдите нужный момент в любом своём курсе — по смыслу, не только по точным словам.
      </p>

      <form action="/app/search" method="get" className="mt-5">
        <div className="flex items-center gap-2 rounded-xl border border-foreground/20 bg-background px-3 focus-within:border-amber-500/50">
          <Search className="size-5 shrink-0 text-foreground/40" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Например: работа с возражением по цене"
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Найти
          </button>
        </div>
      </form>

      {q.length >= 2 ? (
        hits.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {hits.map((h, i) => (
              <li key={`${h.lessonId}-${h.startSec}-${i}`}>
                <Link
                  href={`/app/learn/${h.courseSlug}/${h.lessonId}?t=${h.startSec}`}
                  className="block rounded-2xl border border-foreground/10 bg-background p-4 transition-colors hover:bg-foreground/[0.03]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{h.lessonTitle}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700">
                      <Clock className="size-3" />
                      {formatTimecode(h.startSec)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/45">{h.courseTitle}</p>
                  <p className="mt-2 text-sm text-foreground/70">{h.snippet}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
            <FileSearch className="mx-auto size-10 text-foreground/30" />
            <p className="mt-3 font-medium">Ничего не нашлось по запросу «{q}»</p>
            <p className="mt-1 text-sm text-foreground/60">
              Попробуйте переформулировать или задать вопрос AI-наставнику внутри урока.
            </p>
          </div>
        )
      ) : null}
    </main>
  );
}
