const WEEKDAY_LABELS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export function daysBetween(startIso: string, endIso: string): string[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const result: string[] = [];
  const cursor = new Date(start.getTime());
  cursor.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function formatWeekdayShort(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAY_LABELS[d.getDay()];
}

export function formatDayNumber(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.getDate().toString();
}

export function monthLabelsBetween(dates: string[]): string[] {
  const seen: string[] = [];
  const formatter = new Intl.DateTimeFormat("ru-RU", { month: "long" });
  dates.forEach((iso) => {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return;
    const name = capitalize(formatter.format(d));
    if (!seen.includes(name)) {
      seen.push(name);
    }
  });
  return seen;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
