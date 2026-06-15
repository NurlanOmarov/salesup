/**
 * Скелет загрузки кабинета ученика. Показывается между навигациями (RSC-страницы
 * с force-dynamic делают запросы к БД). Общая шапка/таб-бар остаются из layout.
 */
export default function StudentLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8" aria-busy="true" aria-label="Загрузка">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-foreground/10" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-foreground/10" />

      <div className="mt-6 h-36 animate-pulse rounded-2xl bg-foreground/10" />

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-foreground/10" />
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-foreground/10" />
        ))}
      </div>
    </main>
  );
}
