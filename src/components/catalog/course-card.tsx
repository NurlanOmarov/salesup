import { Link } from "@/components/i18n/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { formatPrice, coverPublicUrl } from "@/lib/utils";

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

export interface CoursePrices {
  kzt: string;
  rub: string;
  byn: string;
  main: string;
  alt: string;
  ready: boolean;
}

export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  industry: string | null;
  /** Ось витрины «для кого»: EVERYONE — универсальный, SPECIALIZED — под отрасль. */
  audience: "EVERYONE" | "SPECIALIZED";
  coverUrl: string | null;
  priceTiyn: number;
  oldPriceTiyn: number | null;
  hoursLabel: string | null;
  /** Бейдж «В разработке» — управляется в админке (настройки курса). */
  inDevelopment: boolean;
  /** Предрассчитанные строки цен в 3 валютах (BYN основная, KZT/RUB — конвертация по курсу НБ РК). */
  prices?: CoursePrices;
  _count: { modules: number };
};

export function CourseCard({ course }: { course: CourseCardData }) {
  const gradient =
    course.industry && industryGradients[course.industry]
      ? industryGradients[course.industry]
      : "from-slate-700 via-slate-800 to-slate-900";

  const inDevelopment = course.inDevelopment;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
    >
      {/* Обложка */}
      <div className={`relative aspect-video bg-gradient-to-br ${gradient}`}>
        {coverPublicUrl(course.coverUrl, course.id) ? (
          <Image
            src={coverPublicUrl(course.coverUrl, course.id)!}
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
        <h2 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand-strong transition-colors">
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
              <span className="text-lg font-bold">
                {course.prices?.main ?? formatPrice(course.priceTiyn)}
              </span>
              {course.oldPriceTiyn ? (
                <span className="text-sm text-foreground/40 line-through">
                  {formatPrice(course.oldPriceTiyn)}
                </span>
              ) : null}
            </div>
            {course.prices?.ready ? (
              <p className="mt-0.5 text-xs text-foreground/45">{course.prices.alt}</p>
            ) : null}
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
