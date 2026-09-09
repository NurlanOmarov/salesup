import Link from "next/link";
import { Lock, CheckCircle2, LayoutGrid, ChevronRight, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Экран на границе демо-доступа: урок существует и виден в оглавлении, но лежит
 * за оплаченной частью курса. Показываем именно его, а не 404 — закрытый, но
 * видимый контент продаёт, спрятанный не продаёт ничего.
 *
 * У работника организации (isOrgLearner) кнопки оплаты нет: платит не он —
 * его задача сообщить ответственному, что демо закончилось.
 */
export function DemoPaywall({
  courseSlug,
  courseTitle,
  openCount,
  totalLessons,
  percent,
  isOrgLearner,
  contactHref,
}: {
  courseSlug: string;
  courseTitle: string;
  openCount: number;
  totalLessons: number;
  percent: number;
  isOrgLearner: boolean;
  contactHref: string | null;
}) {
  const restLessons = Math.max(0, totalLessons - openCount);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
        <Lock className="size-7" />
      </div>
      <h1 className="mt-4 text-xl font-bold">Дальше — после оплаты</h1>
      <p className="mt-2 text-foreground/70">
        Вам открыт ознакомительный доступ к курсу «{courseTitle}»: {openCount} из{" "}
        {totalLessons} уроков ({percent}%). Этот урок — уже в платной части.
      </p>

      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-foreground/75">
        {[
          `Ещё ${restLessons} ${restLessons === 1 ? "урок" : restLessons < 5 ? "урока" : "уроков"} с видео и конспектами`,
          "Задания и тренажёры по каждому уроку",
          "Итоговый экзамен и сертификат",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {isOrgLearner ? (
          <p className="w-full text-sm text-foreground/60">
            Полный доступ подключает ваша организация — сообщите ответственному за
            обучение, что ознакомительная часть пройдена.
          </p>
        ) : (
          <>
            <Link
              href={`/courses/${courseSlug}`}
              className={buttonVariants({ variant: "accent", size: "sm" })}
            >
              Открыть полный доступ
              <ChevronRight className="size-4" />
            </Link>
            {contactHref ? (
              <a
                href={contactHref}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <MessageCircle className="size-4" />
                Задать вопрос
              </a>
            ) : null}
          </>
        )}
        <Link href="/app" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <LayoutGrid className="size-4" />
          Моё обучение
        </Link>
      </div>
    </main>
  );
}
