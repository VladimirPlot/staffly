import api from "../../../shared/api/apiClient";
import { saveToken } from "../../../shared/utils/storage";
import type { MeResponse } from "../../../entities/user/types";
import { withSessionLock } from "../../../shared/api/sessionLock";
import { refreshSession, selectRestaurant } from "../../../shared/api/apiClient";

export async function login(payload: { phone: string; password: string }) {
  return withSessionLock(async () => {
    const { data } = await api.post("/api/auth/login", payload);
    const token = data?.token as string | undefined;
    if (!token) throw new Error("No token in response");
    saveToken(token, true);
    return { token };
  });
}

export async function register(body: RegisterBody): Promise<{ token: string }> {
  return withSessionLock(async () => {
    const { data } = await api.post("/api/auth/register", body);
    const token = data?.token as string | undefined;
    if (!token) throw new Error("Некорректный ответ сервера (register)");
    saveToken(token, true);
    return { token };
  });
}

/**
 * Refresh access token using HttpOnly refresh cookie.
 * Works even when access token is missing/expired (Bearer must NOT be attached to /api/auth/*).
 */
export async function refresh(): Promise<{ token: string }> {
  return { token: await refreshSession() };
}

/**
 * Logout on backend (revokes refresh session + clears cookie).
 * Access token cleanup is done by AuthProvider.logout().
 */
export async function logout(): Promise<void> {
  await withSessionLock(() => api.post("/api/auth/logout"));
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
  return selectRestaurant(restaurantId);
}
