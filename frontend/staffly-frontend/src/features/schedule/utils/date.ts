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
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "long" });
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
