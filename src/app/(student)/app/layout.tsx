import { StudentHeader, StudentTabBar } from "@/components/student/student-nav";
import { PwaManager } from "@/components/pwa-manager";
import { auth } from "@/auth";
import { dueCount } from "@/lib/learn/review";

/**
 * Общий каркас кабинета ученика: единая верхняя шапка (десктоп) и нижний таб-бар
 * (мобильный). pb-20 на мобильном — чтобы контент не уходил под таб-бар.
 * Бейдж «к повторению» считаем один раз здесь для всей навигации.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const due = session?.user ? await dueCount(session.user.id).catch(() => 0) : 0;
  const isOwner = session?.user?.role === "OWNER";

  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      <StudentHeader dueCount={due} isOwner={isOwner} />
      {children}
      <StudentTabBar dueCount={due} />
      <PwaManager />
    </div>
  );
}
