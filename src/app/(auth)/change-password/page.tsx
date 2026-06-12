import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Смена пароля",
  robots: { index: false },
};

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ChangePasswordForm />;
}
