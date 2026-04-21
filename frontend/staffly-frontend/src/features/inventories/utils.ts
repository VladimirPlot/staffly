import { formatDateFromIso } from "../../shared/utils/date";
import type {
  DishwareInventoryDto,
  DishwareInventoryItemDto,
  DishwareInventorySummaryDto,
  UpdateDishwareInventoryItemRequest,
} from "./api";

export type DishwareInventoryDraftItem = {
  localId: string;
  id?: number;
  name: string;
  photoUrl?: string | null;
  previousQty: string;
  currentQty: string;
  unitPrice: string;
  note: string;
  pendingImageFile?: File | null;
  pendingImagePreviewUrl?: string | null;
  removeImage?: boolean;
};

export type DishwareInventoryDraft = {
  id: number;
  title: string;
  inventoryDate: string;
  status: "DRAFT" | "COMPLETED";
  sourceInventoryId?: number | null;
  sourceInventoryTitle?: string | null;
  comment: string;
  items: DishwareInventoryDraftItem[];
};

export type DishwareInventorySummary = {
  itemCount: number;
  lossQty: number;
  gainQty: number;
  totalLossAmount: number;
  positionsWithLoss: number;
};

let localItemCounter = 1;

function nextLocalItemId() {
  const value = localItemCounter;
  localItemCounter += 1;
  return `dishware-item-${value}`;
}

export function createEmptyDishwareDraftItem(): DishwareInventoryDraftItem {
  return {
    localId: nextLocalItemId(),
    name: "",
    photoUrl: null,
    previousQty: "0",
    currentQty: "",
    unitPrice: "",
    note: "",
    pendingImageFile: null,
    pendingImagePreviewUrl: null,
    removeImage: false,
  };
}

function formatNumberInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

export function createDishwareDraftFromDto(inventory: DishwareInventoryDto): DishwareInventoryDraft {
  return {
    id: inventory.id,
    title: inventory.title,
    inventoryDate: inventory.inventoryDate,
    status: inventory.status,
    sourceInventoryId: inventory.sourceInventoryId ?? null,
    sourceInventoryTitle: inventory.sourceInventoryTitle ?? null,
    comment: inventory.comment ?? "",
    items: inventory.items.map((item) => ({
      localId: nextLocalItemId(),
      id: item.id,
      name: item.name,
      photoUrl: item.photoUrl ?? null,
      previousQty: formatNumberInput(item.previousQty),
      currentQty: formatNumberInput(item.currentQty),
      unitPrice: formatNumberInput(item.unitPrice ?? null),
      note: item.note ?? "",
      pendingImageFile: null,
      pendingImagePreviewUrl: null,
      removeImage: false,
    })),
  };
}

export function cleanupDishwareDraftItem(item: DishwareInventoryDraftItem) {
  if (item.pendingImagePreviewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(item.pendingImagePreviewUrl);
  }
}

export function cleanupDishwareDraft(draft: DishwareInventoryDraft | null) {
  if (!draft) return;
  draft.items.forEach(cleanupDishwareDraftItem);
}

export function parseCount(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function parseMoney(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function computeDishwareItemMetrics(item: {
  previousQty: string | number;
  currentQty: string | number;
  unitPrice?: string | number | null;
}) {
  const previousQty =
    typeof item.previousQty === "number" ? Math.max(item.previousQty, 0) : parseCount(item.previousQty);
  const currentQty =
    typeof item.currentQty === "number" ? Math.max(item.currentQty, 0) : parseCount(item.currentQty);
  const unitPrice =
    typeof item.unitPrice === "number"
      ? item.unitPrice
      : item.unitPrice === null || item.unitPrice === undefined
        ? null
        : parseMoney(item.unitPrice);

  const diff = currentQty - previousQty;
  const lossQty = Math.max(previousQty - currentQty, 0);
  const gainQty = Math.max(currentQty - previousQty, 0);
  const totalAmount = unitPrice !== null ? currentQty * unitPrice : 0;
  const lossAmount = unitPrice !== null ? lossQty * unitPrice : 0;

  return {
    previousQty,
    currentQty,
    unitPrice,
    diff,
    lossQty,
    gainQty,
    totalAmount,
    lossAmount,
  };
}

export function computeDishwareSummary(items: DishwareInventoryDraftItem[]): DishwareInventorySummary {
  return items.reduce<DishwareInventorySummary>(
    (acc, item) => {
      const metrics = computeDishwareItemMetrics(item);
      acc.itemCount += 1;
      acc.lossQty += metrics.lossQty;
      acc.gainQty += metrics.gainQty;
      acc.totalLossAmount += metrics.lossAmount;
      if (metrics.lossQty > 0) {
        acc.positionsWithLoss += 1;
      }
      return acc;
    },
    { itemCount: 0, lossQty: 0, gainQty: 0, totalLossAmount: 0, positionsWithLoss: 0 },
  );
}

export function buildDishwareUpdatePayload(draft: DishwareInventoryDraft): {
  items: UpdateDishwareInventoryItemRequest[];
  hasValidationError: boolean;
} {
  let hasValidationError = false;

  const items = draft.items.map((item, index) => {
    const trimmedName = item.name.trim();
    if (!trimmedName) {
      hasValidationError = true;
    }

    const metrics = computeDishwareItemMetrics(item);

    return {
      id: item.id,
      name: trimmedName,
      previousQty: metrics.previousQty,
      currentQty: metrics.currentQty,
      unitPrice: metrics.unitPrice,
      note: item.note.trim() || null,
      sortOrder: index,
    };
  });

  return { items, hasValidationError };
}

export function formatInventoryDateLabel(value: string) {
  return formatDateFromIso(value);
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

export function formatInventoryLossCount(value: number) {
  const normalized = value === 0 ? 0 : -Math.abs(value);
  return formatInventoryCount(normalized);
}

export function getInventoryStatusLabel(status: DishwareInventoryDto["status"] | DishwareInventorySummaryDto["status"]) {
  return status === "COMPLETED" ? "Завершена" : "Черновик";
}

export function getInventoryStatusBadgeClass(status: DishwareInventoryDto["status"] | DishwareInventorySummaryDto["status"]) {
  const isCompleted = status === "COMPLETED";

  return [
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm",
    "border-subtle bg-[color:var(--staffly-control-hover)]",
    isCompleted ? "text-[var(--staffly-text-strong)]" : "text-default",
  ].join(" ");
}

export function findServerItemMatch(
  serverItems: DishwareInventoryItemDto[],
  draftItem: DishwareInventoryDraftItem,
  index: number,
  usedIds: Set<number>,
) {
  if (draftItem.id) {
    const exact = serverItems.find((item) => item.id === draftItem.id);
    if (exact) {
      usedIds.add(exact.id);
      return exact;
    }
  }

  const fallback = serverItems.find(
    (item) =>
      !usedIds.has(item.id) &&
      item.sortOrder === index &&
      item.name.trim().toLowerCase() === draftItem.name.trim().toLowerCase(),
  );

  if (fallback) {
    usedIds.add(fallback.id);
    return fallback;
  }

  return null;
}
