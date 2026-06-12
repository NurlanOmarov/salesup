import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Ученики",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      industry: true,
      deletedAt: true,
      mustChangePassword: true,
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ученики</h1>
        <Link
          href="/admin/students/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          + Создать ученика
        </Link>
      </div>

      <form className="mt-5" action="/admin/students">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Поиск по имени, e-mail или телефону…"
          className="max-w-md"
        />
      </form>

      <div className="mt-5 overflow-hidden rounded-xl border border-foreground/10 bg-background">
        {students.length === 0 ? (
          <p className="p-8 text-center text-foreground/50">
            {query ? "Ничего не найдено." : "Пока нет учеников. Создайте первого."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Отрасль</th>
                <th className="px-4 py-3 font-medium">Доступы</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-amber-700 hover:underline">
                      {s.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{s.email}</td>
                  <td className="px-4 py-3 text-foreground/70">{s.industry ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground/70">{s._count.enrollments}</td>
                  <td className="px-4 py-3">
                    {s.deletedAt ? (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700">Заблокирован</span>
                    ) : s.mustChangePassword ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">Ждёт входа</span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">Активен</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
