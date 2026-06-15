import { StudentHeader, StudentTabBar } from "@/components/student/student-nav";

/**
 * Общий каркас кабинета ученика: единая верхняя шапка (десктоп) и нижний таб-бар
 * (мобильный). pb-20 на мобильном — чтобы контент не уходил под таб-бар.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      <StudentHeader />
      {children}
      <StudentTabBar />
    </div>
  );
}
