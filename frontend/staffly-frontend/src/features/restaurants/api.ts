import api from "../../shared/api/apiClient";
import type { UiRestaurant } from "../../entities/restaurant/types";

const restaurantCache = new Map<number, RestaurantDto>();

export async function fetchRestaurant(id: number): Promise<RestaurantDto> {
  if (restaurantCache.has(id)) return restaurantCache.get(id)!;
  const { data } = await api.get(`/api/restaurants/${id}`);
  if (!data?.id) {
    throw new Error("Некорректный ответ сервера");
  }
  const restaurant = data as RestaurantDto;
  restaurantCache.set(id, restaurant);
  return restaurant;
}

export async function fetchRestaurantName(id: number): Promise<string> {
  const restaurant = await fetchRestaurant(id);
  return restaurant.name ?? `#${id}`;
}

export async function loadMyRestaurants(): Promise<UiRestaurant[]> {
  const { data } = await api.get("/api/me/memberships");
  if (!Array.isArray(data)) throw new Error("Некорректный ответ сервера");

  const items: UiRestaurant[] = data.map((m: any) => ({
    id: Number(m.restaurantId),
    name: String(m.restaurantName || `#${m.restaurantId}`),
    description: m.restaurantDescription ?? null,
    timezone: String(m.restaurantTimezone || "Europe/Moscow"),
    locked: Boolean(m.restaurantLocked),
    city: "",
    role: String(m.role || ""),
  }));
  return items;
}

export type CreateRestaurantBody = {
  name: string;
  code?: string;
  description?: string;
  timezone: string;
};

export type RestaurantDto = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  timezone: string;
  active: boolean;
  locked: boolean;
};

export async function createRestaurant(
  body: CreateRestaurantBody
): Promise<RestaurantDto> {
  const { data } = await api.post("/api/restaurants", body);
  return data as RestaurantDto;
}

export type UpdateRestaurantBody = {
  name: string;
  description?: string;
  timezone: string;
};

export async function updateRestaurant(
  id: number,
  body: UpdateRestaurantBody
): Promise<RestaurantDto> {
  const { data } = await api.put(`/api/restaurants/${id}`, body);
  restaurantCache.set(id, data as RestaurantDto);
  return data as RestaurantDto;
}

export async function toggleRestaurantLock(id: number): Promise<RestaurantDto> {
  const { data } = await api.post(`/api/restaurants/${id}/lock`);
  restaurantCache.set(id, data as RestaurantDto);
  return data as RestaurantDto;
}

export async function deleteRestaurant(id: number): Promise<void> {
  await api.delete(`/api/restaurants/${id}`);
  restaurantCache.delete(id);
}
