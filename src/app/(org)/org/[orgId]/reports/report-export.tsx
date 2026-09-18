"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  downloadOrgReportXlsx,
  type CourseReportRow,
  type MemberReportRow,
} from "@/lib/org/xlsx-client";
import { Button } from "@/components/ui/button";

/** Кнопка выгрузки отчёта в XLSX. Файл собирается в браузере (lib/org/xlsx-client). */
export function ReportExport({
  orgName,
  members,
  courses,
}: {
  orgName: string;
  members: MemberReportRow[];
  courses: CourseReportRow[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelsIncluded = members.some((m) => m.label);

  async function download() {
    setPending(true);
    setError(null);
    try {
      await downloadOrgReportXlsx({
        orgName,
        generatedAt: new Date().toLocaleString("ru-RU", {
          dateStyle: "short",
          timeStyle: "short",
        }),
        labelsIncluded,
        members,
        courses,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось собрать файл");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void download()} disabled={pending}>
        {pending ? (
          <FileSpreadsheet className="mr-1.5 size-4 animate-pulse" />
        ) : (
          <Download className="mr-1.5 size-4" />
        )}
        {pending ? "Собираем файл…" : "Скачать XLSX"}
      </Button>

      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
