import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { CreateStudentForm } from "./create-student-form";

export const metadata: Metadata = {
  title: "Новый ученик",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string }>;
}) {
  const { name, email } = await searchParams;
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      industry: true,
      // Срок «по тарифу курса» показывается прямо в списке — чтобы выдача
      // доступа не была выбором вслепую.
      accessDuration: true,
    },
  });

  return (
    <main>
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        К списку учеников
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Создать ученика</h1>
      <p className="mt-1 text-foreground/60">
        Аккаунт создаётся с временным паролем; при первом входе ученик сменит его.
      </p>

      <div className="mt-6">
        <CreateStudentForm courses={courses} defaultName={name} defaultEmail={email} />
      </div>
    </main>
  );
}
