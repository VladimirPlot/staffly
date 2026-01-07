import api from "../../../shared/api/apiClient";
import { saveToken } from "../../../shared/utils/storage";
import type { MeResponse } from "../../../entities/user/types";

export async function login(payload: { phone: string; password: string }) {
  const { data } = await api.post("/api/auth/login", payload);
  const token = data?.token as string | undefined;
  if (!token) throw new Error("No token in response");
  saveToken(token);
  return { token };
}

export async function register(body: RegisterBody): Promise<{ token: string }> {
  const { data } = await api.post("/api/auth/register", body);
  const token = data?.token as string | undefined;
  if (!token) throw new Error("Некорректный ответ сервера (register)");
  saveToken(token);
  return { token };
}

/**
 * Refresh access token using HttpOnly refresh cookie.
 * Works even when access token is missing/expired (Bearer must NOT be attached to /api/auth/*).
 */
export async function refresh(): Promise<{ token: string }> {
  const { data } = await api.post("/api/auth/refresh");
  const token = data?.token as string | undefined;
  if (!token) throw new Error("No token in response");
  saveToken(token);
  return { token };
}

/**
 * Logout on backend (revokes refresh session + clears cookie).
 * Access token cleanup is done by AuthProvider.logout().
 */
export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get("/api/me");
  return data as MeResponse;
}

export type RegisterBody = {
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  birthDate: string;
};

export async function switchRestaurant(restaurantId: number): Promise<string> {
  const { data } = await api.post("/api/auth/switch-restaurant", { restaurantId });
  const token = data?.token as string | undefined;
  if (!token) throw new Error("Некорректный ответ сервера (switch-restaurant)");
  saveToken(token);
  return token;
}
