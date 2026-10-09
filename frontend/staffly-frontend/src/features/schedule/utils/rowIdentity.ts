import type { EditableScheduleData, ScheduleCellKey, ScheduleRow } from "../types";

export function scheduleRowKey(row: ScheduleRow): string {
  return row.historical ? `history:${row.id}` : `member:${row.memberId}`;
}

export function scheduleRowCellKey(row: ScheduleRow, day: string): ScheduleCellKey {
  // Published historical rows always have a persisted row id, matching the API key.
  return `${row.historical ? -row.id! : row.memberId}:${day}`;
}

export function canEditScheduleCell(
  schedule: Pick<EditableScheduleData, "rows" | "days">,
  key: ScheduleCellKey,
): boolean {
  const separator = key.indexOf(":");
  const memberId = key.slice(0, separator);
  const day = key.slice(separator + 1);
  return (
    schedule.rows.some((row) => !row.historical && String(row.memberId) === memberId) &&
    schedule.days.some((item) => item.date === day)
  );
}
