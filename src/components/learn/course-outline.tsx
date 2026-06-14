"use client";

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { LessonSidebar, type SidebarModule } from "./lesson-sidebar";

/**
 * Адаптивное оглавление курса. На десктопе (lg+) — обычный сайдбар слева.
 * На мобильном список занимал бы весь экран над видео, и при открытии урока
 * пользователь не видел плеер; поэтому здесь список свёрнут в компактную плашку
 * «Содержание курса · Урок X из N», а видео урока остаётся сразу под ней.
 */
export function CourseOutline({
  courseSlug,
  courseTitle,
  modules,
  currentLessonId,
  position,
}: {
  courseSlug: string;
  courseTitle: string;
  modules: SidebarModule[];
  currentLessonId: string;
  position: { index: number; total: number };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Десктоп — постоянный сайдбар */}
      <div className="hidden lg:block">
        <LessonSidebar
          courseSlug={courseSlug}
          courseTitle={courseTitle}
          modules={modules}
          currentLessonId={currentLessonId}
        />
      </div>

      {/* Мобильный — свёрнутая плашка */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-3 text-left transition-colors hover:bg-foreground/5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
              <ListChecks className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">Содержание курса</span>
              {position.index > 0 ? (
                <span className="block text-xs text-foreground/50">
                  Урок {position.index} из {position.total}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open ? (
          <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-foreground/15 bg-background p-2">
            <LessonSidebar
              courseSlug={courseSlug}
              courseTitle={courseTitle}
              modules={modules}
              currentLessonId={currentLessonId}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
