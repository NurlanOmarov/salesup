import type { Metadata } from "next";
import Link from "next/link";
import { Award, Mail, Clock, CheckCircle2, Circle, GraduationCap, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isEnrollmentActive } from "@/lib/access";
import { CERTIFICATE_REQUEST_EMAIL } from "@/lib/certificates/constants";
import { CertificateCelebration } from "@/components/student/certificate-celebration";

/** Салютуем только свежим сертификатам: иначе первый заход после релиза
 *  осыпал бы конфетти всех, кто получил документ месяцы назад. */
const CELEBRATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const metadata: Metadata = {
  title: "Мои сертификаты",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const session = await requireUser();

  const certs = await db.certificate.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: [{ status: "asc" }, { readyAt: "desc" }],
    select: {
      id: true,
      status: true,
      scorePct: true,
      readyAt: true,
      issuedAt: true,
      courseId: true,
      course: { select: { title: true } },
    },
  });

  // Прогресс к сертификату по курсам, где документа ещё нет: условие выдачи —
  // ВСЕ опубликованные уроки пройдены И сдан итоговый экзамен. Показываем обе
  // части явно, иначе ученик не понимает, чего именно не хватает.
  const certCourseIds = new Set(certs.map((c) => c.courseId));
  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    select: {
      startsAt: true,
      expiresAt: true,
      revokedAt: true,
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          certificateEnabled: true,
          modules: {
            orderBy: { sortOrder: "asc" },
            select: {
              lessons: {
                where: { status: "PUBLISHED" },
                orderBy: { sortOrder: "asc" },
                select: { id: true },
              },
            },
          },
          quizzes: {
            where: { kind: "FINAL_EXAM", status: "PUBLISHED" },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const nowDate = new Date();
  const pendingCourses = enrollments
    .filter((e) => isEnrollmentActive(e, nowDate))
    .map((e) => e.course)
    .filter((c) => c.certificateEnabled && !certCourseIds.has(c.id));

  const pendingLessonIds = pendingCourses.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons.map((l) => l.id)),
  );
  const pendingExamIds = pendingCourses.flatMap((c) => (c.quizzes[0] ? [c.quizzes[0].id] : []));

  const [completedRows, passedRows] = await Promise.all([
    pendingLessonIds.length
      ? db.lessonProgress.findMany({
          where: {
            userId: session.user.id,
            completedAt: { not: null },
            lessonId: { in: pendingLessonIds },
          },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    pendingExamIds.length
      ? db.quizAttempt.findMany({
          where: { userId: session.user.id, status: "PASSED", quizId: { in: pendingExamIds } },
          select: { quizId: true },
        })
      : Promise.resolve([]),
  ]);
  const completedIds = new Set(completedRows.map((r) => r.lessonId));
  const passedExamIds = new Set(passedRows.map((r) => r.quizId));

  const progress = pendingCourses.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    const examId = c.quizzes[0]?.id ?? null;
    const firstUnfinished = lessons.find((l) => !completedIds.has(l.id));
    return {
      slug: c.slug,
      title: c.title,
      total: lessons.length,
      done: lessons.filter((l) => completedIds.has(l.id)).length,
      examId,
      examPassed: examId ? passedExamIds.has(examId) : false,
      nextLessonId: firstUnfinished?.id ?? lessons[0]?.id ?? null,
    };
  });

  const now = Date.now();
  const freshlyIssued = certs
    .filter(
      (c) =>
        c.status === "ISSUED" &&
        c.issuedAt != null &&
        now - c.issuedAt.getTime() < CELEBRATION_WINDOW_MS,
    )
    .map((c) => c.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <CertificateCelebration certificateIds={freshlyIssued} />
      <h1 className="text-2xl font-bold">Мои сертификаты</h1>

      {certs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <Award className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">Сертификатов пока нет</p>
          <p className="mt-1 text-sm text-foreground/60">
            Пройдите все уроки курса и сдайте итоговый экзамен — курс будет отмечен как
            готовый к получению сертификата.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {certs.map((c) => {
            const issued = c.status === "ISSUED";
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-foreground/10 bg-background p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <Award className="size-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{c.course.title}</p>
                      <p className="text-sm text-foreground/60">
                        {issued
                          ? `Выдан ${c.issuedAt?.toLocaleDateString("ru-RU") ?? ""}`
                          : `Готов к получению · ${c.readyAt.toLocaleDateString("ru-RU")}`}
                        {c.scorePct != null ? ` · ${c.scorePct}%` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      issued
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {issued ? (
                      <>
                        <CheckCircle2 className="size-3.5" /> Выдан
                      </>
                    ) : (
                      <>
                        <Clock className="size-3.5" /> Готов к получению
                      </>
                    )}
                  </span>
                </div>

                {!issued ? (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm">
                    <Mail className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-foreground/80">
                      Для получения сертификата отправьте ваше ФИО на почту{" "}
                      <a
                        href={`mailto:${CERTIFICATE_REQUEST_EMAIL}?subject=${encodeURIComponent(
                          `Сертификат: ${c.course.title}`,
                        )}`}
                        className="font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400"
                      >
                        {CERTIFICATE_REQUEST_EMAIL}
                      </a>
                      . Мы подготовим сертификат и вышлем его вам.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {progress.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Что осталось до сертификата</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Сертификат готовится, когда пройдены все уроки курса и сдан итоговый экзамен.
          </p>
          <div className="mt-4 space-y-3">
            {progress.map((p) => {
              const lessonsDone = p.total > 0 && p.done >= p.total;
              return (
                <div key={p.slug} className="rounded-2xl border border-foreground/10 bg-background p-5">
                  <p className="font-semibold">{p.title}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      {lessonsDone ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-foreground/30" />
                      )}
                      <span className={lessonsDone ? "text-foreground/60" : "text-foreground/85"}>
                        Уроки пройдены: {p.done} из {p.total}
                      </span>
                      {!lessonsDone && p.nextLessonId ? (
                        <Link
                          href={`/app/learn/${p.slug}/${p.nextLessonId}`}
                          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                        >
                          <PlayCircle className="size-3.5" />
                          Продолжить
                        </Link>
                      ) : null}
                    </li>
                    <li className="flex items-center gap-2">
                      {p.examPassed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-foreground/30" />
                      )}
                      <span className={p.examPassed ? "text-foreground/60" : "text-foreground/85"}>
                        {p.examPassed ? "Итоговый экзамен сдан" : "Итоговый экзамен не сдан"}
                      </span>
                      {!p.examPassed && p.examId ? (
                        <Link
                          href={`/app/quiz/${p.examId}`}
                          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                        >
                          <GraduationCap className="size-3.5" />
                          Пройти тест
                        </Link>
                      ) : null}
                    </li>
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
