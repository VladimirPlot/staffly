import api from "../../shared/api/apiClient";
import { saveToken } from "../../shared/utils/storage";
import type { MeResponse } from "../../entities/user/types";

export async function login(payload: { phone: string; password: string }) {
  const { data } = await api.post("/api/auth/login", payload);
  if (!data?.token) throw new Error("No token in response");
  saveToken(data.token);
  return data as { token: string };
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get("/api/me");
  return data as MeResponse;
}

export type RegisterBody = {
  phone: string;
  email: string;        // <-- теперь обязателен
  firstName: string;
  lastName: string;
  password: string;
  birthDate: string;
};

export async function register(body: RegisterBody): Promise<{ token: string }> {
  const { data } = await api.post("/api/auth/register", body);
  if (!data?.token) throw new Error("Некорректный ответ сервера (register)");
  return { token: data.token as string };
}

export async function switchRestaurant(restaurantId: number): Promise<string> {
  const { data } = await api.post("/api/auth/switch-restaurant", { restaurantId });
  if (!data?.token) throw new Error("Некорректный ответ сервера (switch-restaurant)");
  saveToken(data.token);
  return data.token as string;
}
