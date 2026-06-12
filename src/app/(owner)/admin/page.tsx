import type { Metadata } from "next";
import Link from "next/link";
import { Users, Inbox, BookOpen } from "lucide-react";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Консоль владельца",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [students, newLeads, courses] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.lead.count({ where: { status: "NEW" } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
  ]);

  const cards = [
    { href: "/admin/students", icon: Users, label: "Ученики", value: students },
    { href: "/admin/leads", icon: Inbox, label: "Новые заявки", value: newLeads },
    { href: "/courses", icon: BookOpen, label: "Опубликовано курсов", value: courses },
  ];

  return (
    <main>
      <h1 className="text-2xl font-bold">Консоль владельца</h1>
      <p className="mt-1 text-foreground/60">
        Создавайте учеников, выдавайте доступы, обрабатывайте заявки.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-foreground/10 bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-sm"
          >
            <c.icon className="size-6 text-amber-600" />
            <p className="mt-3 text-3xl font-bold">{c.value}</p>
            <p className="text-sm text-foreground/60">{c.label}</p>
          </Link>
        ))}
      </div>

      <Link
        href="/admin/students/new"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 transition-colors hover:bg-amber-400"
      >
        + Создать ученика
      </Link>
    </main>
  );
}
