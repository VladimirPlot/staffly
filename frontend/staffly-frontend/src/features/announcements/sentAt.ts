export function formatAnnouncementSentAt(value: string, timezone: string | null): string {
  const date = new Date(value);
  if (!timezone || Number.isNaN(date.getTime())) return "Дата и время недоступны";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
