import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type { RestaurantRole } from "../../shared/types/restaurant";

export type PositionDto = {
  id: number;
  restaurantId: number;
  name: string;
  active: boolean;
  level: RestaurantRole;
  payType: PayType | null;
  payRate: number | null;
  normHours: number | null;
};

export type PayType = "SALARY" | "HOURLY" | "SHIFT";

// Список должностей.
// NEW: добавлен opts.includeInactive и opts.role → прокидываем как query params
export async function listPositions(
  restaurantId: number,
  opts?: { includeInactive?: boolean; role?: RestaurantRole }
): Promise<PositionDto[]> {
  const params: Record<string, any> = {};
  if (opts?.includeInactive) params.includeInactive = true;
  if (opts?.role) params.role = opts.role;

  const { data } = await api.get(`/api/restaurants/${restaurantId}/positions`, { params });
  return data as PositionDto[];
}

// Создать (name + level). active проставим true.
export async function createPosition(
  restaurantId: number,
  payload: { name: string; level: RestaurantRole; payType?: PayType | null; payRate?: number | null; normHours?: number | null }
): Promise<PositionDto> {
  const body = {
    restaurantId,
    name: payload.name.trim(),
    level: payload.level,
    active: true,
    payType: payload.payType ?? null,
    payRate: payload.payRate ?? null,
    normHours: payload.normHours ?? null,
  };
  const { data } = await api.post(`/api/restaurants/${restaurantId}/positions`, body);
  return data as PositionDto;
}

// Обновить. Бэкенд теперь корректно обрабатывает null для active,
// но мы шлём явный boolean, чтобы не было сюрпризов.
export async function updatePosition(
  restaurantId: number,
  positionId: number,
  payload: Partial<Pick<PositionDto, "name" | "level" | "active" | "payType" | "payRate" | "normHours">>
): Promise<PositionDto> {
  const body: any = { restaurantId, ...payload };
  if (typeof body.active !== "boolean") {
    throw new Error('updatePosition: поле "active" обязательно');
  }
  const { data } = await api.put(
    `/api/restaurants/${restaurantId}/positions/${positionId}`,
    body,
  );
  return data as PositionDto;
}

export async function deletePosition(
  restaurantId: number,
  positionId: number
): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/positions/${positionId}`);
}
