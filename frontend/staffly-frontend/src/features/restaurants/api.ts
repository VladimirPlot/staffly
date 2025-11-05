import api from "../../shared/api/apiClient";
import type { UiRestaurant } from "../../entities/restaurant/types";

const nameCache = new Map<number, string>();

export async function fetchRestaurantName(id: number): Promise<string> {
  if (nameCache.has(id)) return nameCache.get(id)!;
  const { data } = await api.get(`/api/restaurants/${id}`);
  const name = data?.name ?? `#${id}`;
  nameCache.set(id, name);
  return name;
}

export async function loadMyRestaurants(): Promise<UiRestaurant[]> {
  const { data } = await api.get("/api/me/memberships");
  if (!Array.isArray(data)) throw new Error("Некорректный ответ сервера");

  const items: UiRestaurant[] = await Promise.all(
    data.map(async (m: any) => {
      const id = Number(m.restaurantId);
      const role = String(m.role || "");
      const name = await fetchRestaurantName(id);
      return { id, name, city: "", role };
    })
  );
  return items;
}

export type CreateRestaurantBody = { name: string; code?: string };

export type RestaurantDto = {
  id: number;
  name: string;
  code: string;
  active: boolean;
};

export async function createRestaurant(
  body: CreateRestaurantBody
): Promise<RestaurantDto> {
  const { data } = await api.post("/api/restaurants", body);
  return data as RestaurantDto;
}
