import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgAdmin } from "@/lib/org/guards";
import { getOrgLicenses } from "@/lib/org/reports";
import { getSupportContacts } from "@/lib/seo/settings";
import { ACCESS_DURATION_LABELS } from "@/lib/admin/enrollment";
import { SeatsBar } from "@/app/(owner)/admin/orgs/org-ui";

export const metadata: Metadata = {
  title: "Лицензии",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Что оплачено и сколько осталось. Отдельная страница, потому что это разговор
 * про деньги: сюда ответственный приходит перед продлением или расширением.
 */
export default async function LicensesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await requireOrgAdmin(orgId);
  const [licenses, support] = await Promise.all([
    getOrgLicenses(ctx.orgId),
    getSupportContacts(),
  ]);

  const soon = new Date(Date.now() + 30 * 86_400_000);

  return (
    <main>
      <h1 className="text-2xl font-bold">Лицензии</h1>
      <p className="mt-1 max-w-2xl text-sm text-foreground/60">
        Место — это доступ одного работника к одному курсу. Освободившееся место
        можно передать другому сотруднику.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-foreground/10 bg-background">
        {licenses.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground/55">
            Лицензий пока нет.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">Курс</th>
                <th className="px-4 py-3 font-medium">Места</th>
                <th className="px-4 py-3 font-medium">Срок доступа</th>
                <th className="px-4 py-3 font-medium">Действует до</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => {
                const endingSoon =
                  l.expiresAt && l.expiresAt.getTime() <= soon.getTime();
                return (
                  <tr key={l.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/courses/${l.courseSlug}`}
                        className="font-medium hover:underline"
                      >
                        {l.courseTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <SeatsBar used={l.seats.used} total={l.seats.total} />
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {ACCESS_DURATION_LABELS[
                        l.accessDuration as keyof typeof ACCESS_DURATION_LABELS
                      ] ?? l.accessDuration}
                    </td>
                    <td className="px-4 py-3">
                      {l.expiresAt ? (
                        <span className={endingSoon ? "text-amber-700" : "text-foreground/70"}>
                          {l.expiresAt.toLocaleDateString("ru-RU")}
                          {endingSoon ? " · скоро" : ""}
                        </span>
                      ) : (
                        <span className="text-foreground/70">бессрочно</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-foreground/10 bg-background p-4">
        <h2 className="text-sm font-semibold">Нужно больше мест или новый курс?</h2>
        <p className="mt-1 text-sm text-foreground/65">
          Напишите нам — выставим счёт и добавим места к текущей лицензии. Срок
          действующей лицензии при этом не сдвигается.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {support.whatsapp ? (
            <a
              href={support.whatsapp}
              className="rounded-lg border border-foreground/15 px-3 py-1.5 font-medium transition-colors hover:bg-foreground/5"
            >
              Написать в WhatsApp
            </a>
          ) : null}
          {support.viber ? (
            <a
              href={support.viber}
              className="rounded-lg border border-foreground/15 px-3 py-1.5 font-medium transition-colors hover:bg-foreground/5"
            >
              Написать в Viber
            </a>
          ) : null}
          {support.phone ? (
            <a
              href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-lg border border-foreground/15 px-3 py-1.5 font-medium transition-colors hover:bg-foreground/5"
            >
              {support.phone}
            </a>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-xs text-foreground/50">
        Условия — в{" "}
        <Link href="/offer-b2b" className="underline hover:text-foreground">
          публичной оферте для организаций
        </Link>
        .
      </p>
    </main>
  );
}
