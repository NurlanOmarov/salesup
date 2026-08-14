import { redirect } from "next/navigation";
import type { OrgStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/**
 * Проверка прав в кабинете организации (docs/B2B-PLAN.md §3).
 *
 * ГЛАВНОЕ ПРАВИЛО: членство проверяется в БД при каждом запросе, а не по токену.
 * Токен несёт orgId/orgRole только для edge-middleware и навигации — он мог быть
 * выпущен до того, как работника разжаловали или организацию заморозили.
 *
 * Второе правило: любое действие над сущностью организации обязано пройти через
 * assertOrgScope — это единственная защита от IDOR (подставить чужой id в форму).
 */

export interface OrgContext {
  userId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  status: OrgStatus;
  /** Владелец платформы, вошедший в кабинет клиента из своей консоли. */
  isOwner: boolean;
}

/**
 * Требует роль ответственного представителя (ORG_ADMIN) в активной организации.
 * Владелец платформы (OWNER) допускается в кабинет любой организации: он ведёт
 * её на старте и должен видеть ровно то же, что клиент.
 *
 * @param orgId — обязателен для OWNER (какую организацию открыть); ORG_ADMIN
 *                получает свою и не может подменить её параметром.
 */
export async function requireOrgAdmin(orgId?: string): Promise<OrgContext> {
  const session = await requireUser();
  const userId = session.user.id;

  if (session.user.role === "OWNER") {
    if (!orgId) redirect("/admin/orgs");
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, slug: true, name: true, status: true },
    });
    if (!org) redirect("/admin/orgs");
    return {
      userId,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      status: org.status,
      isOwner: true,
    };
  }

  const membership = await db.orgMembership.findFirst({
    where: { userId, role: "ORG_ADMIN", isActive: true },
    select: {
      org: { select: { id: true, slug: true, name: true, status: true } },
    },
  });
  if (!membership) redirect("/app");

  // Замороженная организация (просрочка оплаты, оферта п. 5.5): кабинет
  // остаётся доступен только для чтения — иначе клиент не увидит, почему
  // у работников пропал доступ, и не поймёт, что делать.
  if (membership.org.status === "ARCHIVED") redirect("/app");

  return {
    userId,
    orgId: membership.org.id,
    orgSlug: membership.org.slug,
    orgName: membership.org.name,
    status: membership.org.status,
    isOwner: false,
  };
}

/**
 * Бросается, когда действие пытается тронуть сущность чужой организации.
 * Именно этот класс ловит safeAction и превращает в «Недостаточно прав».
 */
export class OrgScopeError extends Error {
  constructor() {
    super("Недостаточно прав");
    this.name = "OrgScopeError";
  }
}

/**
 * Проверяет, что сущность принадлежит организации из контекста.
 * Вызывать в КАЖДОМ действии, принимающем id членства/лицензии/группы/кода.
 */
export function assertOrgScope(
  entity: { orgId: string } | null | undefined,
  ctx: { orgId: string },
): asserts entity is { orgId: string } {
  if (!entity || entity.orgId !== ctx.orgId) throw new OrgScopeError();
}

/**
 * Только для действий, меняющих данные: у замороженной организации кабинет
 * доступен на чтение, но выдавать места и создавать коды нельзя.
 */
export function assertOrgWritable(ctx: OrgContext): void {
  if (ctx.status !== "ACTIVE") {
    throw new Error(
      "Организация приостановлена. Свяжитесь с нами для возобновления доступа.",
    );
  }
}
