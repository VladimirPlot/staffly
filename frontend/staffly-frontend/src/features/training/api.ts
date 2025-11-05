import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../dictionaries/api"; // не используется здесь, просто чтобы было рядом

export type TrainingModule = "MENU" | "BAR";

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
