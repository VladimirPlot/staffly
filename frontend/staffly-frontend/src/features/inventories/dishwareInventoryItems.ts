import type { DishwareInventoryDto, DishwareInventoryItemDto, UpdateDishwareInventoryItemRequest } from "./api";
import type { DishwarePendingPhoto } from "./dishwarePhotoDraft";
import {
  normalizeDishwareCount,
  normalizeDishwareMoney,
  parseDishwareCountInput,
  parseDishwareMoneyInput,
} from "./utils";

export type DishwareInventoryEditableItem = {
  clientId: string;
  id?: number;
  name: string;
  photoUrl?: string | null;
  originalPhotoUrl?: string | null;
  pendingPhoto?: DishwarePendingPhoto;
  removePhoto?: boolean;
  previousQty: number | string;
  incomingQty: number | string;
  currentQty: number | string;
  unitPrice?: number | string | null;
  sortOrder?: number;
  note?: string | null;
};

export function createDishwareInventoryClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyDishwareInventoryItem(sortOrder: number): DishwareInventoryEditableItem {
  return {
    clientId: createDishwareInventoryClientId(),
    name: "",
    photoUrl: null,
    previousQty: 0,
    incomingQty: 0,
    currentQty: 0,
    unitPrice: null,
    sortOrder,
    note: null,
  };
}

export function toEditableDishwareInventoryItems(inventory: DishwareInventoryDto): DishwareInventoryEditableItem[] {
  return inventory.items.map((item, index) => ({
    clientId: item.clientKey ?? String(item.id ?? createDishwareInventoryClientId()),
    id: item.id,
    name: item.name,
    photoUrl: item.photoUrl ?? null,
    originalPhotoUrl: item.originalPhotoUrl ?? null,
    previousQty: normalizeDishwareCount(item.previousQty),
    incomingQty: normalizeDishwareCount(item.incomingQty ?? 0),
    currentQty: normalizeDishwareCount(item.currentQty),
    unitPrice: normalizeDishwareMoney(item.unitPrice ?? null),
    sortOrder: item.sortOrder ?? index,
    note: item.note ?? null,
  }));
}

export function buildDishwareInventoryItemsPayload(
  items: DishwareInventoryEditableItem[],
): UpdateDishwareInventoryItemRequest[] {
  return items.map((item, index) => ({
    id: item.id,
    clientKey: item.clientId,
    name: item.name,
    previousQty: parseDishwareCountInput(String(item.previousQty)),
    incomingQty: parseDishwareCountInput(String(item.incomingQty)),
    currentQty: parseDishwareCountInput(String(item.currentQty)),
    unitPrice: parseDishwareMoneyInput(String(item.unitPrice ?? "")),
    sortOrder: index,
    note: item.note ?? null,
  }));
}

export function findDishwareServerItemById(
  inventory: DishwareInventoryDto,
  itemId: number,
): DishwareInventoryItemDto | null {
  return inventory.items.find((item) => item.id === itemId) ?? null;
}
