const WEEKDAY_LABELS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export function daysBetween(startIso: string, endIso: string): string[] {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return [];
  const result: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function formatWeekdayShort(dateIso: string): string {
  const d = parseIsoDate(dateIso);
  if (!d) return "";
  const weekday = d.getUTCDay();
  return WEEKDAY_LABELS[weekday];
}

export function formatDayNumber(dateIso: string): string {
  const d = parseIsoDate(dateIso);
  if (!d) return "";
  return d.getUTCDate().toString();
}

export function monthLabelsBetween(dates: string[]): string[] {
  const seen: string[] = [];
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "UTC" });
  dates.forEach((iso) => {
    const d = parseIsoDate(iso);
    if (!d) return;
    const name = capitalize(formatter.format(d));
    if (!seen.includes(name)) {
      seen.push(name);
    }
  });
  return seen;
}

export function getTodayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function formatInstantInTimeZone(value: string | null | undefined, timeZone: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function restaurantLocalDateTimeToInstant(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const calendarCheck = new Date(naiveUtc);
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }

  const partsAt = (instant: number) =>
    Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]));

  const oneMinute = 60_000;
  const oneDay = 24 * 60 * oneMinute;
  const offsets = new Set<number>();
  for (let instant = naiveUtc - oneDay; instant <= naiveUtc + oneDay; instant += 30 * oneMinute) {
    const parts = partsAt(instant);
    const renderedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    offsets.add(renderedAsUtc - instant);
  }

  const candidates: number[] = [];
  offsets.forEach((offset) => {
    const instant = naiveUtc - offset;
    const parts = partsAt(instant);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      candidates.push(instant);
    }
  });

  // A gap has no exact round-trip candidate. During an overlap, choosing the
  // minimum of all exact candidates fixes the policy to the earlier instant.
  return candidates.length === 0 ? null : new Date(Math.min(...candidates)).toISOString();
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
