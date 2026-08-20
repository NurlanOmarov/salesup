import type { Metadata } from "next";
import { env } from "@/env";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/org/guards";
import { getOrgLicenses } from "@/lib/org/reports";
import { isInviteUsable } from "@/lib/org/seats";
import { InvitesManager, RevokeInviteButton } from "./invites-manager";

export const metadata: Metadata = {
  title: "Коды доступа",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Коды самозаписи. Ключевой экран обезличивания: вместо того чтобы вводить
 * сотрудников по фамилиям, ответственный печатает коды и раздаёт их — платформа
 * не получает ни одного персонального данного.
 */
export default async function InvitesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await requireOrgAdmin(orgId);

  const [licenses, groups, invites] = await Promise.all([
    getOrgLicenses(ctx.orgId),
    db.orgGroup.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.orgInvite.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        code: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const now = new Date();
  const joinUrl = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/join`;

  return (
    <main>
      <h1 className="text-2xl font-bold">Коды доступа</h1>
      <p className="mt-1 max-w-2xl text-sm text-foreground/60">
        Сотрудник вводит код на странице регистрации, придумывает пароль и сразу
        получает доступ к курсам. Ни фамилия, ни почта, ни телефон при этом не
        передаются — платформа знает его только под условным обозначением.
      </p>

      <ol className="mt-5 max-w-2xl space-y-2 rounded-xl border border-foreground/10 bg-background p-4 text-sm text-foreground/75">
        <li className="flex gap-2.5">
          <span className="font-semibold text-foreground/50">1.</span>
          <span>
            Создайте коды ниже и раздайте их сотрудникам — в чате, письмом или на
            бумаге.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="font-semibold text-foreground/50">2.</span>
          <span>
            Сотрудник открывает{" "}
            <span className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-foreground/90">
              {joinUrl}
            </span>
            , вводит свой код и придумывает пароль.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="font-semibold text-foreground/50">3.</span>
          <span>
            Платформа сразу выдаёт ему логин вида{" "}
            <span className="font-mono text-foreground/90">{ctx.orgSlug}-0001</span> —
            дальше он входит по нему на странице входа. Логины идут по порядку,
            запоминать их вам не нужно: они видны на вкладке «Работники».
          </span>
        </li>
      </ol>

      <div className="mt-6">
        <InvitesManager
          orgId={ctx.orgId}
          licenses={licenses.map((l) => ({
            id: l.id,
            courseTitle: l.courseTitle,
            free: l.seats.free,
          }))}
          groups={groups}
          siteUrl={env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Выданные коды</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10 bg-background">
          {invites.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground/55">
              Пока не создано ни одного кода.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Код</th>
                  <th className="px-4 py-3 font-medium">Создан</th>
                  <th className="px-4 py-3 font-medium">Действует до</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const usable = isInviteUsable(i, now);
                  return (
                    <tr key={i.id} className="border-b border-foreground/5 last:border-0">
                      <td className="px-4 py-3 font-mono">
                        {/* Код целиком показан только в момент создания. */}
                        {i.code.slice(0, 3)}•••{i.code.slice(-2)}
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {i.createdAt.toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-4 py-3 text-foreground/70">
                        {i.expiresAt ? i.expiresAt.toLocaleDateString("ru-RU") : "бессрочно"}
                      </td>
                      <td className="px-4 py-3">
                        {i.revokedAt ? (
                          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                            отозван
                          </span>
                        ) : i.usedCount >= i.maxUses ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                            использован
                          </span>
                        ) : usable ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                            ожидает
                          </span>
                        ) : (
                          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                            истёк
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {usable ? (
                          <RevokeInviteButton orgId={ctx.orgId} inviteId={i.id} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
