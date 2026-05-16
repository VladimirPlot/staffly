import api from "../../shared/api/apiClient";

export type DishwareInventoryStatus = "DRAFT" | "COMPLETED";

export type DishwareInventoryItemDto = {
  id: number;
  name: string;
  photoUrl?: string | null;
  previousQty: number;
  incomingQty?: number | null;
  currentQty: number;
  unitPrice?: number | null;
  sortOrder: number;
  note?: string | null;
  diffQty: number;
  lossQty: number;
  gainQty: number;
  lossAmount: number;
};

export type DishwareInventorySummaryDto = {
  id: number;
  restaurantId: number;
  title: string;
  inventoryDate: string;
  status: DishwareInventoryStatus;
  folderId?: number | null;
  sortOrder: number;
  sourceInventoryId?: number | null;
  sourceInventoryTitle?: string | null;
  comment?: string | null;
  itemsCount: number;
  totalLossQty: number;
  totalLossAmount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  trashedAt?: string | null;
};

export type DishwareInventoryDto = DishwareInventorySummaryDto & {
  items: DishwareInventoryItemDto[];
};

export type DishwareInventoryFolderDto = {
  id: number;
  restaurantId: number;
  parentId: number | null;
  name: string;
  description?: string | null;
  sortOrder: number;
  trashedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDishwareInventoryRequest = {
  title?: string | null;
  inventoryDate: string;
  folderId?: number | null;
  sourceInventoryId?: number | null;
  comment?: string | null;
};

export type UpdateDishwareInventoryItemRequest = {
  id?: number;
  name: string;
  previousQty: number;
  incomingQty?: number | null;
  currentQty: number;
  unitPrice?: number | null;
  sortOrder?: number;
  note?: string | null;
};

export type UpdateDishwareInventoryRequest = {
  title?: string | null;
  inventoryDate: string;
  folderId?: number | null;
  comment?: string | null;
  items: UpdateDishwareInventoryItemRequest[];
};

export type CreateDishwareInventoryFolderRequest = {
  parentId?: number | null;
  name: string;
  description?: string | null;
  sortOrder?: number;
};

export type UpdateDishwareInventoryFolderRequest = {
  name: string;
  description?: string | null;
  sortOrder?: number;
};

export type InventorySectionId = "dishware" | "bar" | "kitchen";

export type InventoryLayoutResponse = {
  layout: InventorySectionId[];
};

export type DishwareInventoryObjectOrder = {
  kind: "folder" | "inventory";
  id: number;
  sortOrder: number;
};

export type ReorderDishwareInventoryObjectsRequest = {
  folderId?: number | null;
  objects: DishwareInventoryObjectOrder[];
};

export type DishwareInventoryPrintFormDownload = {
  blob: Blob;
  fileName: string;
};

function parseContentDispositionFileName(value: string | undefined): string | null {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
}

function sanitizeDishwareInventoryFileName(value: string): string {
  return (value.trim() || "Бланк инвентаризации посуды").replace(/[\\/:*?"<>|]+/g, "_");
}

export async function fetchInventoryLayout(restaurantId: number): Promise<InventoryLayoutResponse> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/layout`);
  return data as InventoryLayoutResponse;
}

export async function saveInventoryLayout(
  restaurantId: number,
  layout: InventorySectionId[],
): Promise<InventoryLayoutResponse> {
  const { data } = await api.put(`/api/restaurants/${restaurantId}/inventories/layout`, { layout });
  return data as InventoryLayoutResponse;
}

export async function listDishwareInventories(restaurantId: number): Promise<DishwareInventorySummaryDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware`);
  return data as DishwareInventorySummaryDto[];
}

export async function listDishwareInventoryTrash(restaurantId: number): Promise<DishwareInventorySummaryDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware/trash`);
  return data as DishwareInventorySummaryDto[];
}

export async function listDishwareInventoryFolders(
  restaurantId: number,
  includeTrashed = false,
): Promise<DishwareInventoryFolderDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware/folders`, {
    params: { includeTrashed },
  });
  return data as DishwareInventoryFolderDto[];
}

export async function createDishwareInventoryFolder(
  restaurantId: number,
  payload: CreateDishwareInventoryFolderRequest,
): Promise<DishwareInventoryFolderDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/inventories/dishware/folders`, payload);
  return data as DishwareInventoryFolderDto;
}

export async function updateDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
  payload: UpdateDishwareInventoryFolderRequest,
): Promise<DishwareInventoryFolderDto> {
  const { data } = await api.put(`/api/restaurants/${restaurantId}/inventories/dishware/folders/${folderId}`, payload);
  return data as DishwareInventoryFolderDto;
}

export async function moveDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
  parentId: number | null,
  sortOrder?: number | null,
): Promise<DishwareInventoryFolderDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/folders/${folderId}/move`, {
    parentId,
    sortOrder,
  });
  return data as DishwareInventoryFolderDto;
}

export async function trashDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
): Promise<DishwareInventoryFolderDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/folders/${folderId}/trash`);
  return data as DishwareInventoryFolderDto;
}

export async function restoreDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
): Promise<DishwareInventoryFolderDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/folders/${folderId}/restore`);
  return data as DishwareInventoryFolderDto;
}

export async function deleteDishwareInventoryFolder(restaurantId: number, folderId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/inventories/dishware/folders/${folderId}`);
}

export async function getDishwareInventory(restaurantId: number, inventoryId: number): Promise<DishwareInventoryDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}`);
  return data as DishwareInventoryDto;
}

export async function downloadDishwareInventoryPrintForm(
  restaurantId: number,
  inventoryId: number,
  title?: string | null,
): Promise<DishwareInventoryPrintFormDownload> {
  const response = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/print-form.xlsx`, {
    responseType: "blob",
  });
  const fileName =
    parseContentDispositionFileName(response.headers["content-disposition"]) ??
    `${sanitizeDishwareInventoryFileName(title ?? "")}.xlsx`;
  return { blob: response.data as Blob, fileName };
}

export async function getDishwareInventoryPrintFormHtml(
  restaurantId: number,
  inventoryId: number,
): Promise<string> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/print-form.html`, {
    responseType: "text",
  });
  return data as string;
}

export async function createDishwareInventory(
  restaurantId: number,
  payload: CreateDishwareInventoryRequest,
): Promise<DishwareInventoryDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/inventories/dishware`, payload);
  return data as DishwareInventoryDto;
}

export async function updateDishwareInventory(
  restaurantId: number,
  inventoryId: number,
  payload: UpdateDishwareInventoryRequest,
): Promise<DishwareInventoryDto> {
  const { data } = await api.put(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}`, payload);
  return data as DishwareInventoryDto;
}

export async function completeDishwareInventory(
  restaurantId: number,
  inventoryId: number,
): Promise<DishwareInventoryDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/complete`);
  return data as DishwareInventoryDto;
}

export async function reopenDishwareInventory(
  restaurantId: number,
  inventoryId: number,
): Promise<DishwareInventoryDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/reopen`);
  return data as DishwareInventoryDto;
}

export async function moveDishwareInventory(
  restaurantId: number,
  inventoryId: number,
  folderId: number | null,
  sortOrder?: number | null,
): Promise<DishwareInventoryDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/move`, {
    folderId,
    sortOrder,
  });
  return data as DishwareInventoryDto;
}

export async function reorderDishwareInventoryObjects(
  restaurantId: number,
  payload: ReorderDishwareInventoryObjectsRequest,
): Promise<void> {
  await api.put(`/api/restaurants/${restaurantId}/inventories/dishware/order`, payload);
}

export async function trashDishwareInventory(restaurantId: number, inventoryId: number): Promise<DishwareInventoryDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/trash`);
  return data as DishwareInventoryDto;
}

export async function restoreDishwareInventory(restaurantId: number, inventoryId: number): Promise<DishwareInventoryDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/restore`);
  return data as DishwareInventoryDto;
}

export async function deleteDishwareInventory(restaurantId: number, inventoryId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}`);
}

export async function uploadDishwareItemImage(
  restaurantId: number,
  inventoryId: number,
  itemId: number,
  file: File,
): Promise<DishwareInventoryDto> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/items/${itemId}/image`,
    formData,
  );
  return data as DishwareInventoryDto;
}

export async function deleteDishwareItemImage(
  restaurantId: number,
  inventoryId: number,
  itemId: number,
): Promise<DishwareInventoryDto> {
  const { data } = await api.delete(
    `/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/items/${itemId}/image`,
  );
  return data as DishwareInventoryDto;
}
