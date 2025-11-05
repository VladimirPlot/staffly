import api from "../../shared/api/apiClient";

export type TrainingModule = "MENU" | "BAR" | "WINE";

export type TrainingCategoryDto = {
  id: number;
  restaurantId: number;
  module: TrainingModule;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
  visiblePositionIds?: number[] | null; // пока не трогаем
};

// Список только активных (по бэку так) + флаг allForManagers (менеджерам/админам показать всё, игнорируя видимость по позициям)
export async function listCategories(
  restaurantId: number,
  module: TrainingModule,
  allForManagers?: boolean
): Promise<TrainingCategoryDto[]> {
  const params = allForManagers ? { allForManagers: true } : undefined;
  const { data } = await api.get(
    `/api/restaurants/${restaurantId}/training/${module}/categories`,
    { params }
  );
  return data as TrainingCategoryDto[];
}

export async function createCategory(
  restaurantId: number,
  module: TrainingModule,
  payload: { name: string; description?: string | null; sortOrder?: number | null }
): Promise<TrainingCategoryDto> {
  const body: TrainingCategoryDto = {
    id: 0 as any,
    restaurantId,
    module, // бэк всё равно возьмёт из пути, но отправим для консистентности
    name: payload.name.trim(),
    description: payload.description ?? null,
    sortOrder: payload.sortOrder ?? 0,
    active: true,
    visiblePositionIds: [],
  };
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/training/${module}/categories`,
    body
  );
  return data as TrainingCategoryDto;
}

export type TrainingItemDto = {
  id: number;
  categoryId: number;
  name: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  imageUrl?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
};

export async function listItems(
  restaurantId: number,
  categoryId: number
): Promise<TrainingItemDto[]> {
  const { data } = await api.get(
    `/api/restaurants/${restaurantId}/training/categories/${categoryId}/items`
  );
  return data as TrainingItemDto[];
}

export async function createItem(
  restaurantId: number,
  payload: {
    categoryId: number;
    name: string;
    composition: string;
    description?: string | null;
    allergens?: string | null;
    sortOrder?: number | null;
  }
): Promise<TrainingItemDto> {
  const body = {
    id: 0 as any,
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    composition: payload.composition.trim(),
    description: payload.description ?? null,
    allergens: payload.allergens ?? null,
    sortOrder: payload.sortOrder ?? 0,
    active: true,
  } satisfies Partial<TrainingItemDto> & { categoryId: number; name: string; composition: string };
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/training/items`,
    body
  );
  return data as TrainingItemDto;
}

export async function updateItem(
  restaurantId: number,
  itemId: number,
  payload: Partial<
    Pick<TrainingItemDto, "categoryId" | "name" | "description" | "composition" | "allergens" | "sortOrder" | "active">
  >
): Promise<TrainingItemDto> {
  const { data } = await api.put(
    `/api/restaurants/${restaurantId}/training/items/${itemId}`,
    payload
  );
  return data as TrainingItemDto;
}

export async function deleteItem(restaurantId: number, itemId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/training/items/${itemId}`);
}

export async function uploadItemImage(
  restaurantId: number,
  itemId: number,
  file: File
): Promise<TrainingItemDto> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/training/items/${itemId}/image`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data as TrainingItemDto;
}

export async function deleteItemImage(
  restaurantId: number,
  itemId: number
): Promise<TrainingItemDto> {
  const { data } = await api.delete(
    `/api/restaurants/${restaurantId}/training/items/${itemId}/image`
  );
  return data as TrainingItemDto;
}

export async function updateCategory(
  restaurantId: number,
  categoryId: number,
  payload: Partial<Pick<TrainingCategoryDto, "name" | "description" | "sortOrder" | "active">>
): Promise<TrainingCategoryDto> {
  // active можно не отправлять, на бэке он опционален
  const body = { restaurantId, ...payload };
  const { data } = await api.put(
    `/api/restaurants/${restaurantId}/training/categories/${categoryId}`,
    body
  );
  return data as TrainingCategoryDto;
}

export async function deleteCategory(restaurantId: number, categoryId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/training/categories/${categoryId}`);
}
