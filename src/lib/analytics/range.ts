import "server-only";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { earliestEventDate } from "./dashboard";

/** Разбор периода из query в конкретные даты. Общий для страницы и экспорта. */
export type ResolvedRange = { from: Date; to: Date; range: string; compare: boolean };

type Getter = (key: string) => string | null | undefined;

export async function resolveRange(get: Getter): Promise<ResolvedRange> {
  const range = get("range") || "30";
  const compare = get("compare") === "1";
  const to = endOfDay(new Date());

  if (range === "custom") {
    const fromStr = get("from");
    const toStr = get("to");
    if (fromStr && toStr) {
      const f = new Date(fromStr);
      const t = new Date(toStr);
      if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
        return { from: startOfDay(f), to: endOfDay(t), range: "custom", compare };
      }
    }
  }

  if (range === "all") {
    const earliest = await earliestEventDate();
    return { from: startOfDay(earliest ?? subDays(to, 29)), to, range: "all", compare };
  }

  const days = range === "7" ? 7 : range === "90" ? 90 : 30;
  const preset = range === "7" || range === "90" ? range : "30";
  return { from: startOfDay(subDays(to, days - 1)), to, range: preset, compare };
}
