import { requireOwner } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/admin-nav";
import type { Metadata } from "next";

// Приватная зона: в robots.txt путь уже закрыт, мета-тег — второй барьер
// (одинаково на всех доменах).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Каркас консоли владельца: единая проверка роли OWNER + навигация (S5.1+). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();

  return (
    <div className="min-h-screen bg-foreground/[0.015]">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
