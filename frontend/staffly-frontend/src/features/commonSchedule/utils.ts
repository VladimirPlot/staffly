import type { CommonScheduleSource } from "./api";
import { scheduleRowCellKey } from "../schedule/utils/rowIdentity";

type Period = { startDate: string; endDate: string };

export function commonScheduleTodaySources(sources: CommonScheduleSource[], today: string) {
  return sources.map((source) => ({
    source,
    rows: source.content.rows.filter(
      (row) =>
        today >= source.content.config.startDate &&
        today <= source.content.config.endDate &&
        Boolean(source.content.cellValues[scheduleRowCellKey(row, today)]?.trim()),
    ),
  }));
}

export function fitsCommonSchedulePeriod(primary: Period, source: Period): boolean {
  return source.startDate >= primary.startDate && source.endDate <= primary.endDate;
}

export function sortCommonScheduleCandidates<T extends Period & { id: number; title: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      b.endDate.localeCompare(a.endDate) ||
      a.title.localeCompare(b.title, "ru", { sensitivity: "base" }) ||
      a.id - b.id,
  );
}

export function formatScheduleDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}
