import Image from "next/image";
import Link from "next/link";
import { requireOrgAdmin } from "@/lib/org/guards";
import { db } from "@/lib/db";
import { LogoutButton } from "@/components/logout-button";
import { OrgNav } from "./org-nav";
import { OrgKeyProvider, type StoredWrap } from "./org-key-provider";

/**
 * Каркас кабинета организации. Единая проверка прав (членство в БД, не токен) —
 * дальше страницы работают с уже проверенным orgId.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await requireOrgAdmin(orgId);

  // Обёртки ключа организации (L2): наружу отдаём только blob и параметры KDF —
  // расшифровка возможна лишь в браузере после ввода фразы. Отдаём обёртку
  // текущего ответственного и recovery: чужие admin-обёртки ему не нужны.
  //
  // Владельцу платформы не отдаём ничего: подписи — данные клиента, и то, что
  // мы не можем их прочитать, держит на себе всю позицию оферты /offer-b2b
  // (п. 10: оператор персональных данных работников — клиент, не платформа).
  const wraps: StoredWrap[] = ctx.isOwner
    ? []
    : (
        await db.orgKeyWrap.findMany({
          where: {
            orgId: ctx.orgId,
            OR: [{ userId: ctx.userId }, { kind: "recovery" }],
          },
          select: { kind: true, wrappedKey: true, kdfSalt: true, kdfParams: true },
        })
      ).map((w) => ({
        kind: w.kind === "recovery" ? "recovery" : "admin",
        wrappedKey: w.wrappedKey,
        kdfSalt: w.kdfSalt,
        kdfParams: w.kdfParams as unknown as StoredWrap["kdfParams"],
      }));

  return (
    <div className="min-h-screen bg-foreground/[0.015]">
      <header className="border-b border-foreground/10 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Image src="/logo.png" alt="" width={28} height={28} className="size-7" priority />
              <span className="hidden text-base font-bold tracking-tight text-brand sm:inline">
                ACTIVE SALES
              </span>
            </Link>
            <span className="truncate text-sm font-semibold text-foreground/80">
              {ctx.orgName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {ctx.isOwner ? (
              <Link
                href={`/admin/orgs/${ctx.orgId}`}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/30"
              >
                режим владельца
              </Link>
            ) : (
              <Link
                href="/app"
                className="text-sm text-foreground/70 transition-colors hover:text-foreground"
              >
                Моё обучение
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
        <OrgNav orgId={ctx.orgId} />
      </header>

      {ctx.status === "SUSPENDED" ? (
        <div className="border-b border-amber-600/25 bg-amber-500/10">
          <p className="mx-auto max-w-6xl px-4 py-2.5 text-sm text-amber-900">
            Доступ приостановлен: работники сейчас не могут открывать уроки. Прогресс
            сохранён — после возобновления доступы вернутся автоматически.
          </p>
        </div>
      ) : null}

      <OrgKeyProvider orgId={ctx.orgId} wraps={wraps} viewerIsOwner={ctx.isOwner}>
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </OrgKeyProvider>
    </div>
  );
}
