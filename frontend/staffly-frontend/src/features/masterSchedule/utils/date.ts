import type { Weekday } from "../types";

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function clampPeriodDays(start: string, end: string): number {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getDateRange(start: string, end: string): string[] {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  const dates: string[] = [];
  for (
    let cursor = new Date(startDate);
    cursor <= endDate;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    dates.push(formatLocalDate(cursor));
  }
  return dates;
}

export function formatDayLabel(dateStr: string) {
  const date = parseLocalDate(dateStr);
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

export function formatShortDate(dateStr: string) {
  const date = parseLocalDate(dateStr);
  const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("ru-RU", { month: "2-digit" }).format(date);
  return `${day}.${month}`;
}

export function getWeekdayToken(dateStr: string): Weekday {
  const date = parseLocalDate(dateStr);
  switch (date.getDay()) {
    case 0:
      return "SUNDAY";
    case 1:
      return "MONDAY";
    case 2:
      return "TUESDAY";
    case 3:
      return "WEDNESDAY";
    case 4:
      return "THURSDAY";
    case 5:
      return "FRIDAY";
    case 6:
      return "SATURDAY";
    default:
      return "MONDAY";
  }
}
