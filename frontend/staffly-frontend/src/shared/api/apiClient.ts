import axios from "axios";
import { clearToken, getToken, saveToken } from "../utils/storage";
import { API_BASE } from "../utils/url";
import { getErrorMessage } from "../utils/errors";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

function isAuthUrl(url?: string) {
  if (!url) return false;
  return (
    url.includes("/api/auth/refresh") ||
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/register") ||
    url.includes("/api/auth/logout")
  );
}

async function runRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post("/api/auth/refresh")
      .then((response) => {
        const token = response.data?.token;
        if (!token) throw new Error("No token in refresh response");
        saveToken(token);
        return token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ✅ Подставляем Bearer только НЕ для /api/auth/*
api.interceptors.request.use((config) => {
  if (isAuthUrl(config.url)) return config;

  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Глобальная обработка ошибок + авто-refresh
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const originalConfig = (error?.config ?? {}) as any;

    if (status === 401 && !originalConfig._retry && !isAuthUrl(originalConfig.url)) {
      originalConfig._retry = true;
      try {
        const token = await runRefresh();
        originalConfig.headers = originalConfig.headers ?? {};
        originalConfig.headers.Authorization = `Bearer ${token}`;
        return api(originalConfig);
      } catch (refreshError) {
        clearToken();
        window.dispatchEvent(new Event("auth:logout"));
        (refreshError as any).friendlyMessage = getErrorMessage(
          refreshError,
          "Сессия истекла. Войдите снова."
        );
        return Promise.reject(refreshError);
      }
    }

    (error as any).friendlyMessage = getErrorMessage(error, "Ошибка при запросе к серверу");
    return Promise.reject(error);
  }
);

export default api;
