import type { SchedulePreferenceCellDto } from "../api";
import type { ShiftMode } from "../types";
import { hasCompleteRangeValue, parseTimeRangeValue, parseTimeValue } from "./timeValues";

export type PreferenceHintTone = "positive" | "negative";

export function isPositivePreference(type: SchedulePreferenceCellDto["type"]): boolean {
  return type === "AVAILABLE";
}

export function isNegativePreference(type: SchedulePreferenceCellDto["type"]): boolean {
  return type === "UNAVAILABLE" || type === "PREFER_DAY_OFF";
}

export function getPreferenceHintLabel(type: SchedulePreferenceCellDto["type"]): string {
  if (type === "AVAILABLE") return "Может работать";
  if (type === "UNAVAILABLE") return "Не может работать";
  return "Предпочитает выходной";
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

function toMinutes(hour: number, minute: number): number {
  return (hour === 0 ? 24 : hour) * 60 + minute;
}

function isValidInterval(startTime: string, endTime: string): boolean {
  const start = parseTimeValue(startTime);
  const end = parseTimeValue(endTime);

  if (start.hour === null || start.minute === null) return false;
  if (end.hour === null || end.minute === null) return false;

  return toMinutes(end.hour, end.minute) > toMinutes(start.hour, start.minute);
}

function hasIntervalOverlap(value: string, hint: SchedulePreferenceCellDto): boolean {
  if (!hint.startTime || !hint.endTime) return true;

  const shiftRange = parseTimeRangeValue(value);
  if (
    shiftRange.from.hour === null ||
    shiftRange.from.minute === null ||
    shiftRange.to.hour === null ||
    shiftRange.to.minute === null
  ) {
    return true;
  }

  const shiftStart = toMinutes(shiftRange.from.hour, shiftRange.from.minute);
  const shiftEnd = toMinutes(shiftRange.to.hour, shiftRange.to.minute);
  if (shiftEnd <= shiftStart) return true;

  if (!isValidInterval(hint.startTime, hint.endTime)) return true;

  const hintStartParsed = parseTimeValue(hint.startTime);
  const hintEndParsed = parseTimeValue(hint.endTime);
  if (
    hintStartParsed.hour === null ||
    hintStartParsed.minute === null ||
    hintEndParsed.hour === null ||
    hintEndParsed.minute === null
  ) {
    return true;
  }

  const hintStart = toMinutes(hintStartParsed.hour, hintStartParsed.minute);
  const hintEnd = toMinutes(hintEndParsed.hour, hintEndParsed.minute);

  return shiftStart < hintEnd && hintStart < shiftEnd;
}

export function hasNegativePreferenceConflict(params: {
  value: string;
  hints: SchedulePreferenceCellDto[];
  shiftMode: ShiftMode;
}): boolean {
  const { value, hints, shiftMode } = params;
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  return hints.some((hint) => {
    if (!isNegativePreference(hint.type)) return false;
    if (hint.fullDay) return true;

    if (shiftMode !== "FULL") return true;
    if (!hasCompleteRangeValue(trimmedValue)) return true;

    return hasIntervalOverlap(trimmedValue, hint);
  });
}
