import type { DishwareInventoryDto, DishwareInventorySummaryDto } from "./api";

export type DishwareInventorySummary = {
  itemCount: number;
  previousQty: number;
  incomingQty: number;
  expectedQty: number;
  currentQty: number;
  lossQty: number;
  gainQty: number;
  totalLossAmount: number;
  positionsWithLoss: number;
};

export const DISHWARE_COUNT_MAX = 1_000_000;
export const DISHWARE_MONEY_MAX = 999_999.99;

export function clampDishwareCount(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(value), 0), DISHWARE_COUNT_MAX);
}

export function normalizeDishwareCount(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(Math.trunc(value), 0);
}

export function clampDishwareMoney(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(Math.max(Math.round(value * 100) / 100, 0), DISHWARE_MONEY_MAX);
}

export function normalizeDishwareMoney(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(Math.round(value * 100) / 100, 0);
}

export function parseDishwareCountInput(value: string): number {
  const normalized = value.trim().replace(/[ \u00a0\u202f]/g, "");
  if (!normalized) return 0;
  if (!/^\d+$/.test(normalized) || Number(normalized) > DISHWARE_COUNT_MAX) {
    throw new Error(`Введите целое количество от 0 до ${DISHWARE_COUNT_MAX.toLocaleString("ru-RU")}`);
  }
  return Number(normalized);
}

export function parseDishwareMoneyInput(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[ \u00a0\u202f]/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) > DISHWARE_MONEY_MAX) {
    throw new Error("Введите цену от 0 до 999 999,99, не более двух знаков после запятой");
  }
  return Number(normalized);
}

// Invalid input stays visible in the editor; totals are hidden until it is corrected.
function previewNumber<T>(parse: (value: string) => T, value: string, fallback: T): T {
  try {
    return parse(value);
  } catch {
    return fallback;
  }
}

export function formatDishwareCountInputValue(value: number | null | undefined) {
  return String(normalizeDishwareCount(value));
}

export function formatDishwareMoneyInputValue(value: number | null | undefined) {
  const normalized = normalizeDishwareMoney(value);
  if (normalized === null) return "";
  return String(normalized);
}

export function computeDishwareItemMetrics(item: {
  previousQty: string | number;
  incomingQty?: string | number | null;
  currentQty: string | number;
  unitPrice?: string | number | null;
}) {
  let inputError: string | null = null;
  try {
    parseDishwareCountInput(String(item.previousQty));
    parseDishwareCountInput(String(item.incomingQty ?? 0));
    parseDishwareCountInput(String(item.currentQty));
    parseDishwareMoneyInput(String(item.unitPrice ?? ""));
  } catch (e) {
    inputError = (e as Error).message;
  }
  const previousQty =
    typeof item.previousQty === "number"
      ? normalizeDishwareCount(item.previousQty)
      : previewNumber(parseDishwareCountInput, item.previousQty, 0);
  const incomingQty =
    typeof item.incomingQty === "number"
      ? normalizeDishwareCount(item.incomingQty)
      : item.incomingQty === null || item.incomingQty === undefined
        ? 0
        : previewNumber(parseDishwareCountInput, item.incomingQty, 0);
  const currentQty =
    typeof item.currentQty === "number"
      ? normalizeDishwareCount(item.currentQty)
      : previewNumber(parseDishwareCountInput, item.currentQty, 0);
  const unitPrice =
    typeof item.unitPrice === "number"
      ? normalizeDishwareMoney(item.unitPrice)
      : item.unitPrice === null || item.unitPrice === undefined
        ? null
        : previewNumber(parseDishwareMoneyInput, item.unitPrice, null);

  const expectedQty = previousQty + incomingQty;
  const diff = currentQty - expectedQty;
  const lossQty = Math.max(expectedQty - currentQty, 0);
  const gainQty = Math.max(currentQty - expectedQty, 0);
  const totalAmount = unitPrice !== null ? currentQty * unitPrice : 0;
  const lossAmount = unitPrice !== null ? lossQty * unitPrice : 0;

  return {
    inputError,
    previousQty,
    incomingQty,
    expectedQty,
    currentQty,
    unitPrice,
    diff,
    lossQty,
    gainQty,
    totalAmount,
    lossAmount,
  };
}

export function computeDishwareSummary(
  items: Array<{
    previousQty: string | number;
    incomingQty?: string | number | null;
    currentQty: string | number;
    unitPrice?: string | number | null;
  }>,
): DishwareInventorySummary {
  return items.reduce<DishwareInventorySummary>(
    (acc, item) => {
      const metrics = computeDishwareItemMetrics(item);
      acc.itemCount += 1;
      acc.previousQty += metrics.previousQty;
      acc.incomingQty += metrics.incomingQty;
      acc.expectedQty += metrics.expectedQty;
      acc.currentQty += metrics.currentQty;
      acc.lossQty += metrics.lossQty;
      acc.gainQty += metrics.gainQty;
      acc.totalLossAmount += metrics.lossAmount;
      if (metrics.lossQty > 0) {
        acc.positionsWithLoss += 1;
      }
      return acc;
    },
    {
      itemCount: 0,
      previousQty: 0,
      incomingQty: 0,
      expectedQty: 0,
      currentQty: 0,
      lossQty: 0,
      gainQty: 0,
      totalLossAmount: 0,
      positionsWithLoss: 0,
    },
  );
}

export function formatInventoryLossAmount(value: number) {
  const normalized = value === 0 ? 0 : -Math.abs(value);

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function formatInventoryCount(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactInventoryNumber(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  if (Math.abs(normalized) < 1_000_000) {
    return formatInventoryCount(normalized);
  }
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(normalized);
}

export function formatCompactInventoryMoney(value: number) {
  const normalized = value === 0 ? 0 : -Math.abs(Number.isFinite(value) ? value : 0);
  if (Math.abs(normalized) < 1_000_000) {
    return formatInventoryLossAmount(normalized);
  }
  return `${new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(normalized)} ₽`;
}

export function formatInventoryLossCount(value: number) {
  const normalized = value === 0 ? 0 : -Math.abs(value);
  return formatInventoryCount(normalized);
}

export function getInventoryStatusBadgeClass(
  status: DishwareInventoryDto["status"] | DishwareInventorySummaryDto["status"],
) {
  const isCompleted = status === "COMPLETED";

  return [
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm",
    "border-subtle bg-[color:var(--staffly-control-hover)]",
    isCompleted ? "text-[var(--staffly-text-strong)]" : "text-default",
  ].join(" ");
}
