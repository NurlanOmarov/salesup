import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentSite, DEFAULT_SITE } from "@/lib/seo/site";
import { CreateOrgForm } from "./create-org-form";

export const metadata: Metadata = {
  title: "Новая организация",
  robots: { index: false },
};

/**
 * Заведение клиента. Поля можно предзаполнить из корпоративной заявки
 * (`/admin/leads` → «Создать организацию»): по свежей заявке владелец не должен
 * переписывать название и контакт руками.
 */
export default async function NewOrgPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string;
    email?: string;
    contact?: string;
    note?: string;
  }>;
}) {
  const prefill = await searchParams;
  // Рынок по умолчанию — домен, с которого владелец сейчас работает: чаще всего
  // клиента заводят там же, где его и продали.
  const site = await currentSite();

  return (
    <main>
      <Link
        href="/admin/orgs"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />К организациям
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Новая организация</h1>
      <p className="mt-1 max-w-lg text-sm text-foreground/60">
        Заведите клиента, затем в его карточке выдайте лицензию на курс и назначьте
        ответственного представителя — дальше компания работает сама.
      </p>

      <div className="mt-6">
        <CreateOrgForm
          defaultName={prefill.name}
          defaultContactEmail={prefill.email}
          defaultContactNote={prefill.contact}
          defaultNote={prefill.note}
          defaultSite={(site ?? DEFAULT_SITE).code}
        />
      </div>
    </main>
  );
}
