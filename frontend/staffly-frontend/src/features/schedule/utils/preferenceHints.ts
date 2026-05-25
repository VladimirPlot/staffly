import type { SchedulePreferenceCellDto } from "../api";
import type { ShiftMode } from "../types";

export type PreferenceHintTone = "positive" | "negative";

export function isPositivePreference(type: SchedulePreferenceCellDto["type"]): boolean {
  return type === "AVAILABLE" || type === "PREFER_WORK";
}

export function isNegativePreference(type: SchedulePreferenceCellDto["type"]): boolean {
  return type === "UNAVAILABLE" || type === "PREFER_DAY_OFF";
}

export function getPreferenceHintLabel(type: SchedulePreferenceCellDto["type"]): string {
  if (type === "AVAILABLE") return "Может";
  if (type === "PREFER_WORK") return "Хочет";
  if (type === "UNAVAILABLE") return "Не может";
  return "Хочет выходной";
}

export function getPreferenceHintTone(type: SchedulePreferenceCellDto["type"]): PreferenceHintTone {
  return isPositivePreference(type) ? "positive" : "negative";
}

export function formatPreferenceHintTime(cell: SchedulePreferenceCellDto): string {
  if (cell.fullDay) return "весь день";
  if (!cell.startTime || !cell.endTime) return "интервал не указан";
  return `${cell.startTime}–${cell.endTime}`;
}

export function canApplyPreferenceHint(params: {
  readOnly: boolean;
  shiftMode: ShiftMode;
  cell: SchedulePreferenceCellDto;
}): boolean {
  const { readOnly, shiftMode, cell } = params;
  if (readOnly || shiftMode !== "FULL") return false;
  if (cell.fullDay || !cell.startTime || !cell.endTime) return false;
  return isPositivePreference(cell.type);
}

export function hasNegativePreferenceConflict(params: {
  value: string;
  hints: SchedulePreferenceCellDto[];
  shiftMode: ShiftMode;
}): boolean {
  const { value, hints } = params;
  if (!value.trim()) return false;
  return hints.some((hint) => isNegativePreference(hint.type));
}
