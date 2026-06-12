import type { Metadata } from "next";
import { db } from "@/lib/db";
import { LeadRow, type LeadView } from "./lead-row";

export const metadata: Metadata = {
  title: "Заявки",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await db.lead.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      contact: true,
      courseId: true,
      message: true,
      status: true,
      comment: true,
      createdAt: true,
    },
  });

  // Подтягиваем названия курсов одним запросом.
  const courseIds = [...new Set(leads.map((l) => l.courseId).filter(Boolean))] as string[];
  const courses = courseIds.length
    ? await db.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(courses.map((c) => [c.id, c.title]));

  const views: LeadView[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    contact: l.contact,
    courseTitle: l.courseId ? (titleById.get(l.courseId) ?? null) : null,
    message: l.message,
    status: l.status,
    comment: l.comment,
    createdAt: l.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
  }));

  return (
    <main>
      <h1 className="text-2xl font-bold">Заявки с лендинга</h1>
      <p className="mt-1 text-foreground/60">
        После устного подтверждения оплаты создайте ученика и выдайте доступ.
      </p>

      <div className="mt-6 space-y-3">
        {views.length === 0 ? (
          <p className="rounded-xl border border-foreground/10 bg-background p-8 text-center text-foreground/50">
            Пока нет заявок.
          </p>
        ) : (
          views.map((lead) => <LeadRow key={lead.id} lead={lead} />)
        )}
      </div>
    </main>
  );
}
