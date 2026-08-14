"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { decryptLabel } from "@/lib/org/crypto";
import {
  downloadOrgReportXlsx,
  type CourseReportRow,
  type MemberReportRow,
} from "@/lib/org/xlsx-client";
import { useOrgKey } from "../org-key-provider";
import { Button } from "@/components/ui/button";

/**
 * Кнопка выгрузки отчёта в XLSX.
 *
 * Файл собирается в браузере (см. lib/org/xlsx-client): подписи сотрудников
 * расшифровываются здесь же, поэтому в выгрузку они попадают в читаемом виде,
 * а на сервер по-прежнему не уходят. Без введённой фразы отчёт выгружается по
 * кодам — это рабочий сценарий, а не ошибка.
 */
export function ReportExport({
  orgName,
  members,
  courses,
}: {
  orgName: string;
  /** Строки с ещё зашифрованными подписями — расшифровка происходит при клике. */
  members: (Omit<MemberReportRow, "label"> & { labelEnc: string | null })[];
  courses: CourseReportRow[];
}) {
  const { status, orgKey } = useOrgKey();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelsIncluded = status === "unlocked" && !!orgKey;

  async function download() {
    setPending(true);
    setError(null);
    try {
      const rows: MemberReportRow[] = await Promise.all(
        members.map(async (m) => ({
          ...m,
          label: orgKey ? await decryptLabel(orgKey, m.labelEnc) : null,
        })),
      );

      await downloadOrgReportXlsx({
        orgName,
        generatedAt: new Date().toLocaleString("ru-RU", {
          dateStyle: "short",
          timeStyle: "short",
        }),
        labelsIncluded,
        members: rows,
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

      <p className="text-xs text-foreground/55">
        {labelsIncluded
          ? "Подписи сотрудников будут включены в файл."
          : "Файл будет по кодам сотрудников. Чтобы добавить подписи, введите парольную фразу на вкладке «Работники»."}
      </p>

      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
