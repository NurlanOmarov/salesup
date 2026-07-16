import type { Metadata } from "next";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { StaticPageBody } from "@/components/landing/static-page-body";

export const revalidate = 300;

// Мета и текст редактируются в /admin/seo. Пока текста нет — заглушка и noindex
// (thin content, аудит п.7); владелец наполняет через AI-черновик и снимает noindex.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/offer");
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: "/offer" },
    robots: { index: !s.noindex, follow: true },
  };
}

export default async function OfferPage() {
  const s = await getStaticPageSeo("/offer");
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Публичная оферта</h1>
      {s.body ? (
        <StaticPageBody text={s.body} />
      ) : (
        <p className="mt-4 text-foreground/70">
          Текст оферты будет добавлен перед запуском (BACKLOG S6.4). Документ
          определяет условия предоставления доступа к курсам, запрет на
          распространение материалов и порядок обработки персональных данных.
        </p>
      )}
    </main>
  );
}
