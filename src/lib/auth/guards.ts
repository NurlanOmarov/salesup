import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";

/**
 * Требует аутентифицированного пользователя. Иначе — редирект на /login.
 * Возвращает session с гарантированным user.
 */
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  return session;
}

/** Требует роль OWNER. Иначе — редирект (не владелец → в кабинет ученика). */
export async function requireOwner(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role !== "OWNER") redirect("/app");
  return session;
}
