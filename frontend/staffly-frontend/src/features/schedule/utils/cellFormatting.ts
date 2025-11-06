import type { ShiftMode } from "../types";

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
  const stripped = input.replace(/[^0-9]/g, "");
  if (!stripped) return "";
  if (stripped.length <= 2) {
    return padToTwo(stripped);
  }
  const hours = padToTwo(stripped.slice(0, 2));
  const minutes = padToTwo(stripped.slice(2));
  if (!minutes || minutes === "00") {
    return hours;
  }
  return `${hours}:${minutes}`;
}

function normalizeTimeRange(input: string): string {
  const parts = input
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) {
    return input.trim();
  }
  const from = normalizeTime(parts[0]);
  const to = normalizeTime(parts[1]);
  if (!from || !to) {
    return `${from}${from && to ? "-" : ""}${to}`.trim();
  }
  return `${from}-${to}`;
}

function padToTwo(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
  if (!digits) return "";
  return digits.length === 1 ? `0${digits}` : digits;
}
