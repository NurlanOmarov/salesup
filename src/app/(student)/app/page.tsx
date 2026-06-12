import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: "Кабинет",
  robots: { index: false },
};

export default async function DashboardPage() {
  const session = await requireUser();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Личный кабинет</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-foreground/70">
        Здравствуйте, {session.user.name ?? session.user.email}. Дашборд с курсами
        появится в спринте 4 (S4.2).
      </p>
    </main>
  );
}
