export type TimeValue = {
  hour: number | null;
  minute: number | null;
};

export const MINUTE_STEPS = [0, 15, 30, 45];

export function parseTimeValue(value: string): TimeValue {
  const trimmed = value.trim();
  if (!trimmed) return { hour: null, minute: null };

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return { hour: null, minute: null };

  const hour = Number(match[1]);
  const minute = typeof match[2] === "string" ? Number(match[2]) : 0;

  if (Number.isNaN(hour) || hour < 0 || hour > 24) return { hour: null, minute: null };
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return { hour: null, minute: null };

  return { hour, minute: hour === 24 ? 0 : minute };
}

export function parseTimeRangeValue(value: string): { from: TimeValue; to: TimeValue } {
  const [fromRaw, toRaw] = value
    .split(/[-–—]/)
    .map((part) => part.trim())
    .slice(0, 2);

  return { from: parseTimeValue(fromRaw ?? ""), to: parseTimeValue(toRaw ?? "") };
}

export function normalizeMinuteValue(hour: number, minute: number): number {
  if (hour === 24) return 0;
  if (MINUTE_STEPS.includes(minute)) return minute;

  return MINUTE_STEPS.reduce((closest, current) => {
    const currentDiff = Math.abs(current - minute);
    const closestDiff = Math.abs(closest - minute);
    return currentDiff < closestDiff ? current : closest;
  }, MINUTE_STEPS[0]);
}

export function formatTimeValue(hour: number | null, minute: number | null): string {
  if (hour === null) return "";
  const safeMinute = minute ?? 0;
  return `${String(hour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
}

export function formatTimeWithNormalization(hour: number | null, minute: number | null): string {
  if (hour === null) return "";
  const safeMinute = normalizeMinuteValue(hour, minute ?? 0);
  return `${String(hour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
}

export function formatRangeValue(from: TimeValue, to: TimeValue): string {
  const fromString = formatTimeWithNormalization(from.hour, from.minute);
  const toString = formatTimeWithNormalization(to.hour, to.minute);

  if (fromString && toString) return `${fromString}-${toString}`;
  if (fromString) return fromString;
  if (toString) return toString;
  return "";
}

export function hasCompleteRangeValue(value: string): boolean {
  const { from, to } = parseTimeRangeValue(value);
  return from.hour !== null && to.hour !== null;
}

export function hasStartWithoutEndValue(value: string): boolean {
  const { from, to } = parseTimeRangeValue(value);
  return from.hour !== null && to.hour === null;
}
