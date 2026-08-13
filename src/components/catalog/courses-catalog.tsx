"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { CourseCard, type CourseCardData } from "@/components/catalog/course-card";

/**
 * Смысловой фильтр каталога «Для кого + отрасль».
 * Таблетки строятся из данных: «Все» → «Для всех» (audience=EVERYONE) →
 * по одной на каждую отрасль среди специализированных курсов. Значение
 * активного фильтра живёт в URL (?f=), чтобы ссылку можно было расшарить.
 *
 * Значения фильтра: "all" | "everyone" | "industry:<Название отрасли>".
 * Фильтрация — на клиенте (курсов немного, отклик мгновенный); при росте
 * каталога сюда добавляется текстовый поиск поверх той же сетки.
 */

const ALL = "all";
const EVERYONE = "everyone";
const INDUSTRY_PREFIX = "industry:";

type Facet = { value: string; label: string; count: number };

function buildFacets(courses: CourseCardData[]): Facet[] {
  const facets: Facet[] = [{ value: ALL, label: "Все", count: courses.length }];

  const everyoneCount = courses.filter((c) => c.audience === "EVERYONE").length;
  if (everyoneCount > 0) {
    facets.push({ value: EVERYONE, label: "Для всех", count: everyoneCount });
  }

  const industryCounts = new Map<string, number>();
  for (const c of courses) {
    if (c.audience === "SPECIALIZED" && c.industry) {
      industryCounts.set(c.industry, (industryCounts.get(c.industry) ?? 0) + 1);
    }
  }
  for (const [industry, count] of [...industryCounts].sort((a, b) =>
    a[0].localeCompare(b[0], "ru"),
  )) {
    facets.push({ value: `${INDUSTRY_PREFIX}${industry}`, label: industry, count });
  }

  return facets;
}

function matchesFilter(course: CourseCardData, filter: string): boolean {
  if (filter === ALL) return true;
  if (filter === EVERYONE) return course.audience === "EVERYONE";
  if (filter.startsWith(INDUSTRY_PREFIX)) {
    return (
      course.audience === "SPECIALIZED" &&
      course.industry === filter.slice(INDUSTRY_PREFIX.length)
    );
  }
  return true;
}

export function CoursesCatalog({ courses }: { courses: CourseCardData[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const facets = useMemo(() => buildFacets(courses), [courses]);

  const rawFilter = searchParams.get("f") ?? ALL;
  // Игнорируем фильтр, под который нет ни одной таблетки (устаревшая ссылка).
  const activeFilter = facets.some((f) => f.value === rawFilter) ? rawFilter : ALL;

  const setFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value === ALL) params.delete("f");
      else params.set("f", value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const visible = useMemo(
    () => courses.filter((c) => matchesFilter(c, activeFilter)),
    [courses, activeFilter],
  );

  // Одна таблетка «Все» без альтернатив — фильтр бессмысленен, не показываем.
  const showFilter = facets.length > 1;

  return (
    <>
      {showFilter ? (
        <Reveal>
          <div
            role="tablist"
            aria-label="Фильтр курсов по направлению"
            className="mt-8 flex flex-wrap gap-2"
          >
            {facets.map((f) => {
              const active = f.value === activeFilter;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-foreground/15 text-foreground/70 hover:border-brand/40 hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ml-1.5 text-xs ${active ? "text-white/70" : "text-foreground/40"}`}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>
      ) : null}

      {visible.length === 0 ? (
        <Reveal>
          <div className="mt-16 text-center text-foreground/40">
            <BookOpen className="mx-auto mb-4 size-12 opacity-30" />
            <p className="font-medium">В этом направлении пока нет курсов</p>
            <p className="mt-1 text-sm">Скоро добавим — загляните в другие категории.</p>
          </div>
        </Reveal>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c, i) => (
            <Reveal key={c.slug} delay={i * 0.04}>
              {/* Подсвечиваем курсы со скидкой — единственный признак «выгодно»,
                  который сейчас есть в данных. Если скидка будет у большинства,
                  подсветку надо перевести на отдельный флаг курса. */}
              <CourseCard course={c} highlight={c.oldPriceTiyn != null} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}
