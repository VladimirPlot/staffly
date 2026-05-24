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

const inventoriesPath = (restaurantId: number, ...segments: Array<string | number>) =>
  `/api/restaurants/${restaurantId}/inventories${segments.length ? `/${segments.join("/")}` : ""}`;

const dishwarePath = (restaurantId: number, ...segments: Array<string | number>) =>
  inventoriesPath(restaurantId, "dishware", ...segments);

const dishwareFolderPath = (restaurantId: number, ...segments: Array<string | number>) =>
  dishwarePath(restaurantId, "folders", ...segments);

const responseData = async <T>(request: Promise<{ data: T }>): Promise<T> => (await request).data;

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
  return responseData(api.get<InventoryLayoutResponse>(inventoriesPath(restaurantId, "layout")));
}

export async function saveInventoryLayout(
  restaurantId: number,
  layout: InventorySectionId[],
): Promise<InventoryLayoutResponse> {
  return responseData(api.put<InventoryLayoutResponse>(inventoriesPath(restaurantId, "layout"), { layout }));
}

export async function listDishwareInventories(restaurantId: number): Promise<DishwareInventorySummaryDto[]> {
  return responseData(api.get<DishwareInventorySummaryDto[]>(dishwarePath(restaurantId)));
}

export async function listDishwareInventoryTrash(restaurantId: number): Promise<DishwareInventorySummaryDto[]> {
  return responseData(api.get<DishwareInventorySummaryDto[]>(dishwarePath(restaurantId, "trash")));
}

export async function listDishwareInventoryFolders(
  restaurantId: number,
  includeTrashed = false,
): Promise<DishwareInventoryFolderDto[]> {
  return responseData(
    api.get<DishwareInventoryFolderDto[]>(dishwareFolderPath(restaurantId), {
      params: { includeTrashed },
    }),
  );
}

export async function createDishwareInventoryFolder(
  restaurantId: number,
  payload: CreateDishwareInventoryFolderRequest,
): Promise<DishwareInventoryFolderDto> {
  return responseData(api.post<DishwareInventoryFolderDto>(dishwareFolderPath(restaurantId), payload));
}

export async function updateDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
  payload: UpdateDishwareInventoryFolderRequest,
): Promise<DishwareInventoryFolderDto> {
  return responseData(api.put<DishwareInventoryFolderDto>(dishwareFolderPath(restaurantId, folderId), payload));
}

export async function moveDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
  parentId: number | null,
  sortOrder?: number | null,
): Promise<DishwareInventoryFolderDto> {
  return responseData(
    api.patch<DishwareInventoryFolderDto>(dishwareFolderPath(restaurantId, folderId, "move"), {
      parentId,
      sortOrder,
    }),
  );
}

export async function trashDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
): Promise<DishwareInventoryFolderDto> {
  return responseData(api.patch<DishwareInventoryFolderDto>(dishwareFolderPath(restaurantId, folderId, "trash")));
}

export async function restoreDishwareInventoryFolder(
  restaurantId: number,
  folderId: number,
): Promise<DishwareInventoryFolderDto> {
  return responseData(api.patch<DishwareInventoryFolderDto>(dishwareFolderPath(restaurantId, folderId, "restore")));
}

export async function deleteDishwareInventoryFolder(restaurantId: number, folderId: number): Promise<void> {
  await api.delete(dishwareFolderPath(restaurantId, folderId));
}

export async function getDishwareInventory(restaurantId: number, inventoryId: number): Promise<DishwareInventoryDto> {
  return responseData(api.get<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId)));
}

export async function downloadDishwareInventoryPrintForm(
  restaurantId: number,
  inventoryId: number,
  title?: string | null,
): Promise<DishwareInventoryPrintFormDownload> {
  const response = await api.get<Blob>(dishwarePath(restaurantId, inventoryId, "print-form.xlsx"), {
    responseType: "blob",
  });
  const fileName =
    parseContentDispositionFileName(response.headers["content-disposition"]) ??
    `${sanitizeDishwareInventoryFileName(title ?? "")}.xlsx`;
  return { blob: response.data, fileName };
}

export async function getDishwareInventoryPrintFormHtml(restaurantId: number, inventoryId: number): Promise<string> {
  return responseData(
    api.get<string>(dishwarePath(restaurantId, inventoryId, "print-form.html"), {
      responseType: "text",
    }),
  );
}

export async function createDishwareInventory(
  restaurantId: number,
  payload: CreateDishwareInventoryRequest,
): Promise<DishwareInventoryDto> {
  return responseData(api.post<DishwareInventoryDto>(dishwarePath(restaurantId), payload));
}

export async function updateDishwareInventory(
  restaurantId: number,
  inventoryId: number,
  payload: UpdateDishwareInventoryRequest,
): Promise<DishwareInventoryDto> {
  return responseData(api.put<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId), payload));
}

export async function completeDishwareInventory(
  restaurantId: number,
  inventoryId: number,
): Promise<DishwareInventoryDto> {
  return responseData(api.post<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "complete")));
}

export async function reopenDishwareInventory(
  restaurantId: number,
  inventoryId: number,
): Promise<DishwareInventoryDto> {
  return responseData(api.post<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "reopen")));
}

export async function moveDishwareInventory(
  restaurantId: number,
  inventoryId: number,
  folderId: number | null,
  sortOrder?: number | null,
): Promise<DishwareInventoryDto> {
  return responseData(
    api.patch<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "move"), {
      folderId,
      sortOrder,
    }),
  );
}

export async function reorderDishwareInventoryObjects(
  restaurantId: number,
  payload: ReorderDishwareInventoryObjectsRequest,
): Promise<void> {
  await api.put(dishwarePath(restaurantId, "order"), payload);
}

export async function trashDishwareInventory(restaurantId: number, inventoryId: number): Promise<DishwareInventoryDto> {
  return responseData(api.patch<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "trash")));
}

export async function restoreDishwareInventory(
  restaurantId: number,
  inventoryId: number,
): Promise<DishwareInventoryDto> {
  return responseData(api.patch<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "restore")));
}

export async function deleteDishwareInventory(restaurantId: number, inventoryId: number): Promise<void> {
  await api.delete(dishwarePath(restaurantId, inventoryId));
}

export async function uploadDishwareItemImage(
  restaurantId: number,
  inventoryId: number,
  itemId: number,
  file: File,
): Promise<DishwareInventoryDto> {
  const formData = new FormData();
  formData.append("file", file);
  return responseData(
    api.post<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "items", itemId, "image"), formData),
  );
}

export async function deleteDishwareItemImage(
  restaurantId: number,
  inventoryId: number,
  itemId: number,
): Promise<DishwareInventoryDto> {
  return responseData(
    api.delete<DishwareInventoryDto>(dishwarePath(restaurantId, inventoryId, "items", itemId, "image")),
  );
}
