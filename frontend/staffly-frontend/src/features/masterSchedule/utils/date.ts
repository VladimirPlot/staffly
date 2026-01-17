export function clampPeriodDays(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getDateRange(start: string, end: string): string[] {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dates: string[] = [];
  for (
    let cursor = new Date(startDate);
    cursor <= endDate;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export function formatDayLabel(dateStr: string) {
  const date = new Date(dateStr);
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date);
  const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("ru-RU", { month: "2-digit" }).format(date);
  return {
    weekday,
    day,
    month,
    isFriday: date.getDay() === 5,
    isSaturday: date.getDay() === 6,
    isMonday: date.getDay() === 1,
  };
}
