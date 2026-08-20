import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { isEnrollmentActive } from "@/lib/access";
import { currentSite } from "@/lib/seo/site";
import { DEFAULT_SITE } from "@/lib/seo/site-hosts";
import { EnrollmentManager, DangerZone, DeviceLimitForm } from "./manage";

export const metadata: Metadata = {
  title: "Карточка ученика",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();

  const student = await db.user.findFirst({
    where: { id, role: "STUDENT" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      industry: true,
      deletedAt: true,
      mustChangePassword: true,
      deviceLimit: true,
      createdAt: true,
      enrollments: {
        select: {
          courseId: true,
          startsAt: true,
          expiresAt: true,
          revokedAt: true,
          course: { select: { title: true } },
        },
      },
    },
  });
  if (!student) notFound();

  const [allCourses, logs, site] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
    db.adminLog.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true },
    }),
    currentSite(),
  ]);

  const enrolledIds = new Set(student.enrollments.map((e) => e.courseId));
  const grantable = allCourses.filter((c) => !enrolledIds.has(c.id));

  const enrollments = student.enrollments.map((e) => {
    let status: "active" | "revoked" | "expired" = "active";
    if (e.revokedAt) status = "revoked";
    else if (!isEnrollmentActive({ startsAt: e.startsAt, expiresAt: e.expiresAt, revokedAt: e.revokedAt }, now))
      status = "expired";
    return {
      courseId: e.courseId,
      title: e.course.title,
      status,
      expiresAt: fmtDate(e.expiresAt),
    };
  });

  const actionLabels: Record<string, string> = {
    "student.create": "Создан ученик",
    "enrollment.grant": "Выдан доступ",
    "enrollment.revoke": "Отозван доступ",
    "enrollment.extend": "Продлён доступ",
    "password.reset": "Сброшен пароль",
    "student.block": "Заблокирован вход",
    "student.unblock": "Разблокирован вход",
    "student.device_limit": "Изменён лимит устройств",
  };

  return (
    <main>
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        К списку учеников
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{student.name ?? student.email}</h1>
        {student.deletedAt ? (
          <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-700">Заблокирован</span>
        ) : student.mustChangePassword ? (
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">Ждёт первого входа</span>
        ) : (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Активен</span>
        )}
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-foreground/50">E-mail:</dt>
          <dd className="font-medium">{student.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-foreground/50">Телефон:</dt>
          <dd>{student.phone ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-foreground/50">Отрасль:</dt>
          <dd>{student.industry ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-foreground/50">Создан:</dt>
          <dd>{fmtDate(student.createdAt)}</dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <EnrollmentManager
          userId={student.id}
          enrollments={enrollments}
          grantable={grantable}
          defaultSite={site?.code ?? DEFAULT_SITE.code}
        />
        <DangerZone userId={student.id} blocked={!!student.deletedAt} />
        <DeviceLimitForm userId={student.id} deviceLimit={student.deviceLimit} />
      </div>

      {/* Журнал действий по этому ученику */}
      <section className="mt-5 rounded-2xl border border-foreground/10 bg-background p-5">
        <h2 className="font-semibold">Журнал действий</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-foreground/50">Нет записей.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-foreground/70">
                <span className="text-xs text-foreground/40">
                  {l.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span>{actionLabels[l.action] ?? l.action}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
