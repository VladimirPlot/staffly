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
  sourceInventoryId?: number | null;
  sourceInventoryTitle?: string | null;
  comment?: string | null;
  itemsCount: number;
  totalLossQty: number;
  totalLossAmount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type DishwareInventoryDto = DishwareInventorySummaryDto & {
  items: DishwareInventoryItemDto[];
};

export type CreateDishwareInventoryRequest = {
  title?: string | null;
  inventoryDate: string;
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
  status: DishwareInventoryStatus;
  comment?: string | null;
  items: UpdateDishwareInventoryItemRequest[];
};

export async function listDishwareInventories(restaurantId: number): Promise<DishwareInventorySummaryDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inventories/dishware`);
  return data as DishwareInventorySummaryDto[];
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
