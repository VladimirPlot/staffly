import type { ShiftMode } from "../types";
import { formatRangeValue, formatTimeWithNormalization, parseTimeRangeValue, parseTimeValue } from "./timeValues";

export function normalizeCellValue(value: string, mode: ShiftMode): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  switch (mode) {
    case "ARRIVAL_ONLY":
      return normalizeTime(trimmed);
    case "FULL":
      return normalizeTimeRange(trimmed);
    case "NONE":
    default:
      return trimmed;
  }
}

function normalizeTime(input: string): string {
  const parsed = parseTimeValue(input);
  return formatTimeWithNormalization(parsed.hour, parsed.minute);
}

function normalizeTimeRange(input: string): string {
  const { from, to } = parseTimeRangeValue(input);
  return formatRangeValue(from, to);
}
