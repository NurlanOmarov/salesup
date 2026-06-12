import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: "Админ",
  robots: { index: false },
};

export default async function AdminHomePage() {
  await requireOwner();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Консоль владельца</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-foreground/70">
        Управление учениками и доступами появится в спринте 5 (S5.1).
      </p>
    </main>
  );
}
