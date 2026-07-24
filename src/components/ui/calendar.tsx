"use client";

import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

/**
 * Календарь на react-day-picker (v10). Базовые стили пакета + переопределение
 * акцентного цвета под бренд через CSS-переменные rdp. Русская локаль.
 */
export function Calendar({
  className,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={ru}
      showOutsideDays
      className={cn("rdp-brand", className)}
      style={
        {
          "--rdp-accent-color": "var(--color-brand)",
          "--rdp-accent-background-color": "color-mix(in srgb, var(--color-brand) 14%, transparent)",
          "--rdp-day-height": "2.25rem",
          "--rdp-day-width": "2.25rem",
          "--rdp-day_button-height": "2.25rem",
          "--rdp-day_button-width": "2.25rem",
          "--rdp-font-size": "0.875rem",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
