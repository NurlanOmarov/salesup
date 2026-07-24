"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Кнопка выгрузки отчёта в XLSX / PDF. Ссылки ведут на серверный route, который
 * пересобирает дашборд за тот же период (params) и отдаёт файл attachment'ом.
 */
export function ExportMenu({ params }: { params: string }) {
  const [open, setOpen] = useState(false);
  const href = (format: "xlsx" | "pdf") => `/admin/analytics/export?format=${format}&${params}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-foreground/5">
          <Download className="size-4" />
          Экспорт
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <a
          href={href("xlsx")}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
        >
          <FileSpreadsheet className="size-4 text-emerald-600" />
          <span>
            <span className="block font-medium">Excel (XLSX)</span>
            <span className="block text-xs text-foreground/50">Таблицы по всем разделам</span>
          </span>
        </a>
        <a
          href={href("pdf")}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
        >
          <FileText className="size-4 text-brand" />
          <span>
            <span className="block font-medium">PDF-отчёт</span>
            <span className="block text-xs text-foreground/50">Сводка для печати</span>
          </span>
        </a>
      </PopoverContent>
    </Popover>
  );
}
