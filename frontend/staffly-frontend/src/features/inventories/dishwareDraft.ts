import type { DishwareInventoryDto } from "./api";
import {
  buildDishwareInventoryItemsPayload,
  toEditableDishwareInventoryItems,
  type DishwareInventoryEditableItem,
} from "./dishwareInventoryItems.ts";
import { parseDishwareCountInput, parseDishwareMoneyInput } from "./utils.ts";
import { isDishwarePendingPhoto } from "./dishwarePhotoDraft.ts";

export type DishwareDraft = {
  includeSurplus?: boolean;
  title: string;
  inventoryDate: string;
  comment: string;
  items: DishwareInventoryEditableItem[];
};
export type PendingDishwareSave = {
  requestId: string;
  expectedVersion: number;
  folderId: number | null;
  snapshot: DishwareDraft;
  input: DishwareDraft;
  base: DishwareDraft | null;
};
export type StoredDishwareDraft = {
  version: 1;
  base: string;
  draft: DishwareDraft;
  needsReview?: boolean;
  baseDraft?: DishwareDraft;
  pendingSave?: PendingDishwareSave;
};
export const emptyDishwareDraft: DishwareDraft = { title: "", inventoryDate: "", comment: "", items: [] };

export function dishwareDraftFromServer(data: DishwareInventoryDto): DishwareDraft {
  return {
    includeSurplus: data.includeSurplus ?? false,
    title: data.title,
    inventoryDate: data.inventoryDate,
    comment: data.comment ?? "",
    items: toEditableDishwareInventoryItems(data),
  };
}

function canonicalNumber(value: number | string | null | undefined, money = false) {
  try {
    return money ? parseDishwareMoneyInput(String(value ?? "")) : parseDishwareCountInput(String(value ?? ""));
  } catch {
    return value;
  }
}

// Photos are saved separately; client/server row IDs do not change the draft's contents.
export function dishwareDraftFingerprint(draft: DishwareDraft, includePhotoChanges = true): string {
  return JSON.stringify({
    title: draft.title.trim(),
    inventoryDate: draft.inventoryDate,
    comment: draft.comment.trim(),
    ...(draft.includeSurplus ? { includeSurplus: true } : {}),
    items: draft.items.map((item) => ({
      name: item.name.trim(),
      previousQty: canonicalNumber(item.previousQty),
      incomingQty: canonicalNumber(item.incomingQty),
      currentQty: canonicalNumber(item.currentQty),
      unitPrice: canonicalNumber(item.unitPrice, true),
      note: item.note?.trim() ?? "",
      ...(includePhotoChanges && item.pendingPhoto ? { pendingPhoto: item.pendingPhoto.token } : {}),
      ...(includePhotoChanges && item.removePhoto ? { removePhoto: true } : {}),
    })),
  });
}

export function dishwareDraftError(draft: DishwareDraft): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.inventoryDate) ||
    !Number.isFinite(Date.parse(draft.inventoryDate)) ||
    new Date(draft.inventoryDate).toISOString().slice(0, 10) !== draft.inventoryDate
  )
    return "Укажите корректную дату инвентаризации";
  if (draft.title.length > 200) return "Название не может быть длиннее 200 символов";
  if (draft.comment.length > 5000) return "Комментарий не может быть длиннее 5000 символов";
  if (draft.items.length > 500) return "В документе может быть не более 500 позиций";
  for (const [index, item] of draft.items.entries()) {
    const prefix = `Позиция ${index + 1}: `;
    if (!item.name.trim()) return prefix + "укажите название";
    if (item.name.length > 200) return prefix + "название не может быть длиннее 200 символов";
    if ((item.note?.length ?? 0) > 5000) return prefix + "заметка не может быть длиннее 5000 символов";
    try {
      buildDishwareInventoryItemsPayload([item]);
    } catch (e) {
      return prefix + (e as Error).message;
    }
  }
  return null;
}

export function dishwareDraftKey(userId: number, restaurantId: number, inventoryId: number): string {
  return `staffly:dishware-draft:v1:${userId}:${restaurantId}:${inventoryId}`;
}

export function readDishwareDraft(storage: Pick<Storage, "getItem">, key: string): StoredDishwareDraft | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredDishwareDraft;
    const d = value?.draft;
    if (
      value.version !== 1 ||
      typeof value.base !== "string" ||
      (value.needsReview !== undefined && typeof value.needsReview !== "boolean") ||
      !d ||
      typeof d.title !== "string" ||
      typeof d.inventoryDate !== "string" ||
      typeof d.comment !== "string" ||
      (d.includeSurplus !== undefined && typeof d.includeSurplus !== "boolean") ||
      !Array.isArray(d.items)
    )
      return null;
    const ids = new Set<string>();
    if (
      value.baseDraft &&
      !readDishwareDraft({ getItem: () => JSON.stringify({ version: 1, base: "", draft: value.baseDraft }) }, key)
    )
      return null;
    if (value.pendingSave) {
      const operation = value.pendingSave;
      if (
        typeof operation.requestId !== "string" ||
        !Number.isSafeInteger(operation.expectedVersion) ||
        operation.expectedVersion < 0 ||
        (operation.folderId != null && !Number.isSafeInteger(operation.folderId)) ||
        !readDishwareDraft(
          { getItem: () => JSON.stringify({ version: 1, base: "", draft: operation.snapshot }) },
          key,
        ) ||
        !readDishwareDraft({ getItem: () => JSON.stringify({ version: 1, base: "", draft: operation.input }) }, key) ||
        (operation.base != null &&
          !readDishwareDraft({ getItem: () => JSON.stringify({ version: 1, base: "", draft: operation.base }) }, key))
      )
        return null;
    }
    for (const item of d.items) {
      if (
        !item ||
        typeof item.clientId !== "string" ||
        ids.has(item.clientId) ||
        typeof item.name !== "string" ||
        ![item.previousQty, item.incomingQty, item.currentQty].every(
          (v) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)),
        ) ||
        (item.unitPrice != null && typeof item.unitPrice !== "string" && typeof item.unitPrice !== "number") ||
        (item.note != null && typeof item.note !== "string") ||
        (item.photoUrl != null && typeof item.photoUrl !== "string") ||
        (item.originalPhotoUrl != null && typeof item.originalPhotoUrl !== "string") ||
        (item.pendingPhoto !== undefined && !isDishwarePendingPhoto(item.pendingPhoto)) ||
        (item.removePhoto !== undefined && typeof item.removePhoto !== "boolean") ||
        (item.id != null && (!Number.isSafeInteger(item.id) || item.id <= 0))
      )
        return null;
      ids.add(item.clientId);
    }
    return value;
  } catch {
    return null;
  }
}

// A slow save must not replace text typed while its request was in flight.
export function mergeDishwareSavedRows(
  current: DishwareDraft,
  sent: DishwareDraft,
  saved: DishwareInventoryDto,
): DishwareDraft {
  const byKey = new Map(saved.items.map((item) => [item.clientKey ?? String(item.id), item]));
  const serverByClientId = new Map(
    sent.items.map((item, index) => [item.clientId, byKey.get(item.clientId) ?? saved.items[index]]),
  );
  return {
    ...current,
    items: current.items.map((item) => {
      const server = serverByClientId.get(item.clientId);
      return server
        ? {
            ...item,
            id: server.id,
            photoUrl: server.photoUrl ?? null,
            originalPhotoUrl: server.originalPhotoUrl ?? null,
          }
        : item;
    }),
  };
}
