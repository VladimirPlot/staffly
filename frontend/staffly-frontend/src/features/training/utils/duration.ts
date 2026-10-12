/** Exact display for limits and elapsed time, without dropping remaining seconds. */
export function formatTrainingDuration(seconds?: number | null, emptyLabel = "Без ограничения"): string {
  if (seconds == null) return emptyLabel;
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return [minutes > 0 ? `${minutes} мин` : "", remainder > 0 || minutes === 0 ? `${remainder} сек` : ""]
    .filter(Boolean)
    .join(" ");
}
