export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}
