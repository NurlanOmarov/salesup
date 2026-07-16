import type { Metadata } from "next";
import { getStaticPageSeo } from "@/lib/seo/static-pages";
import { StaticPageBody } from "@/components/landing/static-page-body";

export const revalidate = 300;

// Мета и текст редактируются в /admin/seo. Пока текста нет — заглушка и noindex
// (thin content, аудит п.7); владелец наполняет через AI-черновик и снимает noindex.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStaticPageSeo("/privacy");
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: "/privacy" },
    robots: { index: !s.noindex, follow: true },
  };
}

export default async function PrivacyPage() {
  const s = await getStaticPageSeo("/privacy");
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Политика конфиденциальности</h1>
      {s.body ? (
        <StaticPageBody text={s.body} />
      ) : (
        <p className="mt-4 text-foreground/70">
          Текст политики будет добавлен перед запуском (BACKLOG S6.4): состав
          собираемых данных, цели обработки, сроки хранения и право на удаление.
        </p>
      )}
    </main>
  );
}
