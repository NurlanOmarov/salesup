import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/logout-button";

/** Каркас консоли владельца: единая проверка роли OWNER + навигация (S5.1+). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();

  return (
    <div className="min-h-screen bg-foreground/[0.015]">
      <header className="border-b border-foreground/10 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className="px-3 py-1.5 font-semibold">
              Консоль
            </Link>
            <Link
              href="/admin/students"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Ученики
            </Link>
            <Link
              href="/admin/courses"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Курсы
            </Link>
            <Link
              href="/admin/leads"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Заявки
            </Link>
            <Link
              href="/admin/usage"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Расходы LLM
            </Link>
            <Link
              href="/admin/digest"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Дайджест
            </Link>
            <Link
              href="/admin/certificates"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Сертификат
            </Link>
            <Link
              href="/admin/flags"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Активность
            </Link>
            <Link
              href="/admin/seo"
              className="rounded-md px-3 py-1.5 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              SEO
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
