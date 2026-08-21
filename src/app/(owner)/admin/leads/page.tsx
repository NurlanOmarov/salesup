import type { Metadata } from "next";
import { db } from "@/lib/db";
import { describeStoredPlan } from "@/lib/leads/quote";
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
      consentAt: true,
      consentVersion: true,
      kind: true,
      format: true,
      company: true,
      seatsWanted: true,
      plan: true,
      quotedPerSeatTiyn: true,
      quotedTotalTiyn: true,
      withTrainer: true,
      site: true,
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
    kind: l.kind,
    format: l.format,
    company: l.company,
    seatsWanted: l.seatsWanted,
    name: l.name,
    contact: l.contact,
    courseTitle: l.courseId ? (titleById.get(l.courseId) ?? null) : null,
    // Тариф и цена на момент подачи: с тех пор прайс мог измениться, поэтому
    // показываем зафиксированное, а не пересчитываем.
    plan: describeStoredPlan({
      plan: l.plan,
      seats: l.seatsWanted,
      perSeatTiyn: l.quotedPerSeatTiyn,
      totalTiyn: l.quotedTotalTiyn,
      withTrainer: l.withTrainer,
    }),
    message: l.message,
    status: l.status,
    comment: l.comment,
    site: l.site,
    createdAt: l.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
    // Отметка о согласии на обработку ПДн — доказательство по Закону № 99-З.
    consent: l.consentAt
      ? `${l.consentAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}, ред. ${l.consentVersion ?? "—"}`
      : null,
  }));

  // Офлайн обрабатывается иначе: по нему в платформе ничего не создаётся,
  // поэтому счётчик выносим в шапку — чтобы такие заявки не терялись в списке.
  const offlineCount = views.filter((v) => v.format === "OFFLINE").length;

  return (
    <main>
      <h1 className="text-2xl font-bold">Заявки с лендинга</h1>
      <p className="mt-1 text-foreground/60">
        После устного подтверждения оплаты создайте ученика и выдайте доступ.
        Корпоративные заявки помечены — по ним заводится организация, а не ученик.
        {offlineCount > 0 ? (
          <>
            {" "}
            Заявок на офлайн-тренинг:{" "}
            <span className="font-medium text-violet-700">{offlineCount}</span> — они
            обрабатываются вне платформы.
          </>
        ) : null}
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
