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
): Promise<DishwareInventoryFolderDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/folders/${folderId}/move`, {
    parentId,
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
): Promise<DishwareInventoryDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/inventories/dishware/${inventoryId}/move`, {
    folderId,
  });
  return data as DishwareInventoryDto;
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
