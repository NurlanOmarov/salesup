import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { RedirectsManager } from "./redirects-manager";

export const metadata: Metadata = {
  title: "Редиректы",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function RedirectsPage() {
  const redirects = await db.redirect.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, from: true, to: true, hits: true },
  });

  return (
    <main>
      <Link
        href="/admin/seo"
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        К SEO-настройкам
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Редиректы</h1>
      <p className="mt-1 text-foreground/60">
        301/308-перенаправления. Главный кейс — смена slug курса фабрикой: заведите
        редирект со старого адреса на новый, чтобы не терять позиции и внешние ссылки.
        Источник — относительный путь (напр. <code>/courses/staryj-slug</code>).
      </p>

      <RedirectsManager redirects={redirects} />
    </main>
  );
}
