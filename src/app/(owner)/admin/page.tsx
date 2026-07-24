import type { Metadata } from "next";
import Link from "next/link";
import { Users, Inbox, BookOpen, Coins } from "lucide-react";
import { db } from "@/lib/db";
import { formatUsd } from "@/lib/ai/pricing";

export const metadata: Metadata = {
  title: "Консоль владельца",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [students, newLeads, courses, draftCourses, llm] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.lead.count({ where: { status: "NEW" } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.course.count({ where: { status: "DRAFT" } }),
    db.llmUsage.aggregate({ _sum: { costMicroUsd: true } }),
  ]);

  const cards: {
    href: string;
    icon: typeof Users;
    label: string;
    value: string | number;
    note: string | null;
  }[] = [
    { href: "/admin/students", icon: Users, label: "Ученики", value: students, note: null },
    { href: "/admin/leads", icon: Inbox, label: "Новые заявки", value: newLeads, note: null },
    {
      href: "/courses",
      icon: BookOpen,
      label: "Опубликовано курсов",
      value: courses,
      note: draftCourses > 0 ? `${draftCourses} в разработке` : null,
    },
    {
      href: "/admin/usage",
      icon: Coins,
      label: "Расходы LLM",
      value: formatUsd(llm._sum.costMicroUsd ?? 0),
      note: null,
    },
  ];

  return (
    <main>
      <h1 className="text-2xl font-bold">Консоль владельца</h1>
      <p className="mt-1 text-foreground/60">
        Создавайте учеников, выдавайте доступы, обрабатывайте заявки.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-foreground/10 bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-sm"
          >
            <c.icon className="size-6 text-amber-600" />
            <p className="mt-3 text-3xl font-bold">{c.value}</p>
            <p className="text-sm text-foreground/60">{c.label}</p>
            {c.note ? (
              <p className="mt-0.5 text-xs text-amber-600/80">{c.note}</p>
            ) : null}
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
