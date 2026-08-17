import type { ScheduleAutoBuildMatchStatus, SchedulePreferenceCellDto } from "../api";
import type { ShiftMode } from "../types";
import { hasCompleteRangeValue, parseTimeRangeValue, parseTimeValue } from "./timeValues";

export type PreferenceHintTone = "positive" | "negative";

export type PreferenceAssignmentBadge = {
  status: Extract<
    ScheduleAutoBuildMatchStatus,
    "NO_PREFERENCE" | "PARTIAL_INTERVAL_FALLBACK" | "SOFT_NEGATIVE_FALLBACK" | "HARD_NEGATIVE_FALLBACK"
  >;
  label: string;
  title: string;
  className: string;
};

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

function coversShift(value: string, hint: SchedulePreferenceCellDto): boolean {
  if (hint.fullDay) return true;
  if (!hint.startTime || !hint.endTime) return false;
  if (!hasCompleteRangeValue(value)) return false;

  const shiftRange = parseTimeRangeValue(value);
  const hintStart = parseTimeValue(hint.startTime);
  const hintEnd = parseTimeValue(hint.endTime);
  if (
    shiftRange.from.hour === null ||
    shiftRange.from.minute === null ||
    shiftRange.to.hour === null ||
    shiftRange.to.minute === null ||
    hintStart.hour === null ||
    hintStart.minute === null ||
    hintEnd.hour === null ||
    hintEnd.minute === null
  ) {
    return false;
  }

  return (
    toMinutes(hintStart.hour, hintStart.minute) <= toMinutes(shiftRange.from.hour, shiftRange.from.minute) &&
    toMinutes(hintEnd.hour, hintEnd.minute) >= toMinutes(shiftRange.to.hour, shiftRange.to.minute)
  );
}

function findNegativePreferenceConflict(params: {
  value: string;
  hints: SchedulePreferenceCellDto[];
  shiftMode: ShiftMode;
  type: "UNAVAILABLE" | "PREFER_DAY_OFF";
}): boolean {
  const { value, hints, shiftMode, type } = params;
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  return hints.some((hint) => {
    if (hint.type !== type) return false;
    if (hint.fullDay) return true;

    if (shiftMode !== "FULL") return true;
    if (!hasCompleteRangeValue(trimmedValue)) return true;

    return hasIntervalOverlap(trimmedValue, hint);
  });
}

export function hasNegativePreferenceConflict(params: {
  value: string;
  hints: SchedulePreferenceCellDto[];
  shiftMode: ShiftMode;
}): boolean {
  return (
    findNegativePreferenceConflict({ ...params, type: "UNAVAILABLE" }) ||
    findNegativePreferenceConflict({ ...params, type: "PREFER_DAY_OFF" })
  );
}

export function getAutoBuildPreferenceAssignmentBadge(params: {
  value: string;
  hints: SchedulePreferenceCellDto[];
  shiftMode: ShiftMode;
}): PreferenceAssignmentBadge | null {
  const { value, hints, shiftMode } = params;
  const trimmedValue = value.trim();
  if (!trimmedValue || shiftMode !== "FULL" || !hasCompleteRangeValue(trimmedValue)) return null;

  if (hints.length === 0) {
    return {
      status: "NO_PREFERENCE",
      label: "Без пожелания",
      title: "Смена назначена автосборкой, но сотрудник не оставил пожелание на этот день",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  const hasHardNegativeConflict = findNegativePreferenceConflict({
    value: trimmedValue,
    hints,
    shiftMode,
    type: "UNAVAILABLE",
  });
  if (hasHardNegativeConflict) {
    return {
      status: "HARD_NEGATIVE_FALLBACK",
      label: "Не может работать",
      title: "Сотрудник указал, что не может работать в это время",
      className: "border-rose-300 bg-rose-100 text-rose-900",
    };
  }

  const hasSoftNegativeConflict = findNegativePreferenceConflict({
    value: trimmedValue,
    hints,
    shiftMode,
    type: "PREFER_DAY_OFF",
  });
  if (hasSoftNegativeConflict) {
    return {
      status: "SOFT_NEGATIVE_FALLBACK",
      label: "Предпочитает выходной",
      title: "Сотрудник предпочитал выходной в это время",
      className: "border-amber-300 bg-amber-100 text-amber-900",
    };
  }

  const hasPartialPositive = hints.some(
    (hint) =>
      isPositivePreference(hint.type) &&
      !hint.fullDay &&
      hasIntervalOverlap(trimmedValue, hint) &&
      !coversShift(trimmedValue, hint),
  );
  if (hasPartialPositive) {
    return {
      status: "PARTIAL_INTERVAL_FALLBACK",
      label: "Частично вне пожелания",
      title: "Смена частично выходит за пределы положительного пожелания сотрудника",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return null;
}
