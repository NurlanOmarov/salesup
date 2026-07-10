import type { Metadata } from "next";
import Link from "next/link";
import { StickyNote, Clock, BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { listAllNotes } from "@/lib/learn/notes";
import { formatTimecode } from "@/lib/learn/format";

export const metadata: Metadata = {
  title: "Мои заметки",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const session = await requireUser();
  const courses = await listAllNotes(session.user.id);
  const total = courses.reduce(
    (sum, c) => sum + c.lessons.reduce((s, l) => s + l.notes.length, 0),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <StickyNote className="size-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Мои заметки</h1>
        {total > 0 ? (
          <span className="rounded-full bg-foreground/10 px-2 text-sm font-semibold text-foreground/60">
            {total}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-foreground/60">
        Все заметки по урокам в одном месте — клик по таймкоду откроет нужный момент видео.
      </p>

      {total === 0 ? (
        <div className="mt-10 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <BookOpen className="mx-auto size-10 text-foreground/30" />
          <p className="mt-3 font-medium">Заметок пока нет</p>
          <p className="mt-1 text-sm text-foreground/60">
            Открывайте урок и записывайте удачные формулировки на вкладке «Заметки».
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {courses.map((course) => (
            <section key={course.courseSlug}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {course.courseTitle}
              </h2>
              <div className="mt-3 space-y-4">
                {course.lessons.map((lesson) => (
                  <div
                    key={lesson.lessonId}
                    className="rounded-2xl border border-foreground/10 bg-background p-4"
                  >
                    <Link
                      href={`/app/learn/${course.courseSlug}/${lesson.lessonId}`}
                      className="font-semibold hover:text-amber-700"
                    >
                      {lesson.lessonTitle}
                    </Link>
                    <ul className="mt-3 space-y-2">
                      {lesson.notes.map((n) => (
                        <li key={n.id} className="flex items-start gap-3">
                          <Link
                            href={`/app/learn/${course.courseSlug}/${lesson.lessonId}?t=${n.timecodeSec}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 font-mono text-xs font-semibold text-amber-700 hover:bg-amber-500/20"
                          >
                            <Clock className="size-3" />
                            {formatTimecode(n.timecodeSec)}
                          </Link>
                          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground/80">
                            {n.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
