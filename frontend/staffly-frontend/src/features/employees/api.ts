import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../dictionaries/api";

/* ===== Приглашения (оставляем как было) ===== */
export type InviteRequest = {
  phoneOrEmail: string;
  role: RestaurantRole;         // "STAFF" | "MANAGER" | "ADMIN"
  positionId?: number;          // опционально
};

export type InviteResponse = {
  token: string;
  restaurantId: number;
  desiredRole: RestaurantRole;
  positionId?: number;
  expiresAt: string;
};

export async function sendInvite(restaurantId: number, payload: InviteRequest): Promise<InviteResponse> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/employees/invite`, payload);
  return data as InviteResponse;
}

/* ===== Помощник: узнать мою роль в текущем ресторане ===== */
export async function fetchMyRoleIn(restaurantId: number): Promise<RestaurantRole | null> {
  const { data } = await api.get("/api/me/memberships");
  if (!Array.isArray(data)) return null;
  const row = data.find((m: any) => Number(m.restaurantId) === Number(restaurantId));
  return row?.role ?? null;
}

/* ===== Список участников ===== */
export type MemberDto = {
  id: number;                // id записи membership
  userId: number;
  role: RestaurantRole;      // роль доступа в ресторане
  positionId?: number | null;
  positionName?: string | null;

  // Имена: используем то, что вернёт бэк. Любое из этих полей — опционально.
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;

  // День рождения пользователя (если бэк его отдаёт)
  birthDate?: string | null; // ISO, напр. "1998-03-12"
};

export async function listMembers(restaurantId: number): Promise<MemberDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/members`);
  return data as MemberDto[];
}
