import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Как SalesAcademy обрабатывает персональные данные.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Политика конфиденциальности</h1>
      <p className="mt-4 text-foreground/70">
        Текст политики будет добавлен перед запуском (BACKLOG S6.4) с учётом закона
        РК «О персональных данных»: состав собираемых данных, цели обработки,
        сроки хранения и право на удаление.
      </p>
    </main>
  );
}
