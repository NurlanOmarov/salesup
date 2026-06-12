import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Публичная оферта",
  description: "Условия использования платформы SalesAcademy.",
};

export default function OfferPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 prose-sm">
      <h1 className="text-3xl font-bold">Публичная оферта</h1>
      <p className="mt-4 text-foreground/70">
        Текст оферты будет добавлен перед запуском (BACKLOG S6.4). Документ
        определяет условия предоставления доступа к курсам, запрет на
        распространение материалов и порядок обработки персональных данных.
      </p>
    </main>
  );
}
