import type { Metadata } from "next";

// Приватная зона: в robots.txt путь уже закрыт, мета-тег — второй барьер
// (одинаково на всех доменах).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {children}
    </main>
  );
}
