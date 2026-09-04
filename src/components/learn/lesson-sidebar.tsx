import Link from "next/link";
import { CheckCircle2, Circle, Lock, PlayCircle, GraduationCap } from "lucide-react";

export interface SidebarLesson {
  id: string;
  title: string;
  available: boolean; // опубликован и открыт по порядку прохождения
  completed: boolean;
  /** Опубликован, но закрыт: не сдано задание одного из предыдущих уроков. */
  locked?: boolean;
}

export interface SidebarModule {
  title: string;
  lessons: SidebarLesson[];
}

/** Итоговый экзамен курса — доступен с любого урока, не только из кабинета. */
export interface SidebarExam {
  id: string;
  title: string;
  passScore: number;
  passed: boolean;
}

/** Оглавление курса для страницы обучения (S4.2): модули, статусы уроков, текущий. */
export function LessonSidebar({
  courseSlug,
  courseTitle,
  modules,
  currentLessonId,
  exam = null,
}: {
  courseSlug: string;
  courseTitle: string;
  modules: SidebarModule[];
  currentLessonId: string;
  exam?: SidebarExam | null;
}) {
  return (
    <nav className="text-sm" aria-label="Оглавление курса">
      <p className="px-3 text-xs font-semibold uppercase tracking-wide text-foreground/40">
        {courseTitle}
      </p>
      <div className="mt-3 space-y-4">
        {modules.map((m, mi) => (
          <div key={mi}>
            <p className="px-3 text-xs font-medium text-foreground/50">{m.title}</p>
            <ul className="mt-1">
              {m.lessons.map((l) => {
                const isCurrent = l.id === currentLessonId;
                const Icon = l.completed ? CheckCircle2 : l.available ? Circle : Lock;
                const inner = (
                  <span
                    className={[
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
                      isCurrent
                        ? "bg-amber-500/10 font-medium text-amber-800"
                        : l.available
                          ? "text-foreground/75 hover:bg-foreground/5"
                          : "text-foreground/35",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "size-4 shrink-0",
                        l.completed ? "text-emerald-600" : isCurrent ? "text-amber-600" : "text-foreground/30",
                      ].join(" ")}
                    />
                    <span className="line-clamp-2">{l.title}</span>
                    {isCurrent ? <PlayCircle className="ml-auto size-4 shrink-0 text-amber-600" /> : null}
                  </span>
                );
                return (
                  <li key={l.id}>
                    {l.available ? (
                      <Link href={`/app/learn/${courseSlug}/${l.id}`} aria-current={isCurrent ? "page" : undefined}>
                        {inner}
                      </Link>
                    ) : (
                      <div
                        aria-disabled
                        title={l.locked ? "Откроется после сдачи задания предыдущего урока" : undefined}
                      >
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {exam ? (
        <Link
          href={`/app/quiz/${exam.id}`}
          className="mt-4 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 transition-colors hover:bg-amber-500/10"
        >
          <GraduationCap className={`size-4 shrink-0 ${exam.passed ? "text-emerald-600" : "text-amber-600"}`} />
          <span className="min-w-0">
            <span className="block font-medium text-foreground/85">{exam.title}</span>
            <span className="block text-xs text-foreground/50">
              {exam.passed ? "Сдан" : `Проходной балл — ${exam.passScore}%`}
            </span>
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
