import type { Metadata } from "next";
import { Award, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Сертификат — образец",
  robots: { index: false },
};

/**
 * Образец сертификата для владельца: показывает, что получает ученик после успешного
 * прохождения курса (сдачи финального экзамена). PDF рендерится роутом preview с
 * заглушечными данными — реальные ФИО/курс/баллы подставляются при выдаче (lib/certificates).
 */
export default function AdminCertificatesPage() {
  const previewUrl = "/admin/certificates/preview";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Award className="size-6 text-amber-500" />
          Образец сертификата
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Так выглядит именной сертификат, который ученик скачивает после прохождения
          курса и сдачи финального экзамена. Имя, название курса, объём, результат и
          номер подставляются автоматически; QR-код ведёт на страницу проверки
          подлинности. Данные ниже — демонстрационные.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-foreground/10 bg-foreground/[0.02]">
        <iframe
          src={previewUrl}
          title="Образец сертификата"
          className="h-[600px] w-full"
        />
      </div>

      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 transition-colors hover:text-amber-500"
      >
        <ExternalLink className="size-4" />
        Открыть PDF в новой вкладке
      </a>
    </div>
  );
}
