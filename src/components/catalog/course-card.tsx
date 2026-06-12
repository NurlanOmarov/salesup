import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils";

const industryGradients: Record<string, string> = {
  "Туризм": "from-sky-700 via-sky-800 to-slate-900",
  "Мебель и кухни": "from-orange-700 via-orange-800 to-slate-900",
  "Обувь и одежда": "from-pink-700 via-pink-800 to-slate-900",
  "Недвижимость": "from-emerald-700 via-emerald-800 to-slate-900",
  "Медпредставители": "from-teal-700 via-teal-800 to-slate-900",
  "B2B-переговоры": "from-indigo-700 via-indigo-800 to-slate-900",
  "FMCG": "from-violet-700 via-violet-800 to-slate-900",
  "Розница": "from-rose-700 via-rose-800 to-slate-900",
};

export type CourseCardData = {
  slug: string;
  title: string;
  subtitle: string | null;
  industry: string | null;
  coverUrl: string | null;
  priceTiyn: number;
  oldPriceTiyn: number | null;
  hoursLabel: string | null;
  _count: { modules: number };
};

// Единственный готовый курс — остальные пока в разработке.
const READY_COURSE_SLUG = "sales-pharma";

export function CourseCard({ course }: { course: CourseCardData }) {
  const gradient =
    course.industry && industryGradients[course.industry]
      ? industryGradients[course.industry]
      : "from-slate-700 via-slate-800 to-slate-900";

  const inDevelopment = course.slug !== READY_COURSE_SLUG;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
    >
      {/* Обложка */}
      <div className={`relative aspect-video bg-gradient-to-br ${gradient}`}>
        {course.coverUrl ? (
          <Image
            src={course.coverUrl}
            alt={course.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : null}
        {inDevelopment ? (
          <span className="absolute right-3 top-3 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur">
            В разработке
          </span>
        ) : null}
        <div className="absolute inset-0 flex items-end p-4">
          {course.industry ? (
            <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">
              {course.industry}
            </span>
          ) : null}
        </div>
      </div>

      {/* Контент */}
      <div className="flex flex-1 flex-col p-5">
        <h2 className="line-clamp-2 font-semibold leading-snug group-hover:text-amber-700 transition-colors">
          {course.title}
        </h2>
        {course.subtitle ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-foreground/60">
            {course.subtitle}
          </p>
        ) : null}

        <div className="mt-auto pt-4 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{formatPrice(course.priceTiyn)}</span>
              {course.oldPriceTiyn ? (
                <span className="text-sm text-foreground/40 line-through">
                  {formatPrice(course.oldPriceTiyn)}
                </span>
              ) : null}
            </div>
          </div>
          {course.hoursLabel ? (
            <span className="flex items-center gap-1 text-xs text-foreground/40">
              <Clock className="size-3.5" />
              {course.hoursLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
