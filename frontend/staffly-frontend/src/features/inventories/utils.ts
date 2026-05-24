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

export const DISHWARE_COUNT_MAX = 99_999;
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
  const normalized = value.replace(/\s+/g, "").replace(",", ".").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return clampDishwareCount(parsed);
}

export function parseDishwareMoneyInput(value: string): number | null {
  const normalized = value.replace(/\s+/g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return clampDishwareMoney(parsed);
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
  const previousQty =
    typeof item.previousQty === "number"
      ? normalizeDishwareCount(item.previousQty)
      : parseDishwareCountInput(item.previousQty);
  const incomingQty =
    typeof item.incomingQty === "number"
      ? normalizeDishwareCount(item.incomingQty)
      : item.incomingQty === null || item.incomingQty === undefined
        ? 0
        : parseDishwareCountInput(item.incomingQty);
  const currentQty =
    typeof item.currentQty === "number"
      ? normalizeDishwareCount(item.currentQty)
      : parseDishwareCountInput(item.currentQty);
  const unitPrice =
    typeof item.unitPrice === "number"
      ? normalizeDishwareMoney(item.unitPrice)
      : item.unitPrice === null || item.unitPrice === undefined
        ? null
        : parseDishwareMoneyInput(item.unitPrice);

  const expectedQty = previousQty + incomingQty;
  const diff = currentQty - expectedQty;
  const lossQty = Math.max(expectedQty - currentQty, 0);
  const gainQty = Math.max(currentQty - expectedQty, 0);
  const totalAmount = unitPrice !== null ? currentQty * unitPrice : 0;
  const lossAmount = unitPrice !== null ? lossQty * unitPrice : 0;

  return {
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
