import type { Metadata } from "next";
import { getSupportContacts } from "@/lib/seo/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // «Забыли пароль» → контакт владельца из SeoSettings (правится в /admin/seo).
  const contacts = await getSupportContacts();
  const supportContact = contacts.whatsapp || contacts.telegram || undefined;

  return (
    <LoginForm callbackUrl={callbackUrl} supportContact={supportContact} />
  );
}
