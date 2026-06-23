export function sanitizeFileName(name: string): string {
  const safe = name?.trim() || "checklist";
  return safe.replace(/[\\/:*?"<>|]+/g, "_");
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function resetReasonLabel(reason?: string | null): string {
  if (reason === "AUTO") return "Авто";
  if (reason === "MANUAL") return "Вручную";
  return "—";
}

export function hasPhoto(url?: string | null): boolean {
  return Boolean(url && url.trim());
}
