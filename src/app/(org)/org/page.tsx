import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/**
 * Вход в кабинет организации без указания её id: ответственного представителя
 * уводим в его организацию, владельца платформы — в реестр клиентов.
 * Сам кабинет живёт в /org/[orgId] — так владелец открывает кабинет клиента
 * тем же кодом, что видит и клиент (никакого второго интерфейса).
 */
export default async function OrgIndexPage() {
  const session = await requireUser();

  if (session.user.role === "OWNER") redirect("/admin/orgs");

  const membership = await db.orgMembership.findFirst({
    where: { userId: session.user.id, role: "ORG_ADMIN", isActive: true },
    select: { orgId: true },
  });
  if (!membership) redirect("/app");

  redirect(`/org/${membership.orgId}`);
}
