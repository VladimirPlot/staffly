import axios from "axios";
import { clearToken, getAuthEpoch, getToken, saveToken } from "../utils/storage";
import { isSessionRejected, withSessionLock } from "./sessionLock";
import { API_BASE } from "../utils/url";
import { getErrorMessage } from "../utils/errors";
import { trackMutation } from "../pwa/reloadSafety";
import { getTokenRestaurantId } from "../utils/tokenContext";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 20_000,
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
    const tokenBefore = getToken(); // 👈 запоминаем, что было ДО refresh
    const epochBefore = getAuthEpoch();

    refreshPromise = withSessionLock(async () => {
      if (getAuthEpoch() !== epochBefore) throw new Error("Session changed");
      const current = getToken();
      if (current && current !== tokenBefore) return current;
      const response = await refreshClient.post("/api/auth/refresh", {
        restaurantId: getTokenRestaurantId(tokenBefore),
      });
      if (getAuthEpoch() !== epochBefore) throw new Error("Session changed");
      const refreshed = response.data?.token as string | undefined;
      if (!refreshed) throw new Error("No token in refresh response");

      // 👇 если пока мы делали refresh, токен уже изменился (например, логином) — НЕ перезаписываем
      const tokenAfter = getToken();
      if (tokenAfter && tokenAfter !== tokenBefore) {
        return tokenAfter;
      }

      saveToken(refreshed);
      return refreshed;
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// ✅ Подставляем Bearer только НЕ для /api/auth/*
api.interceptors.request.use((config) => {
  const trackedConfig = config as typeof config & { finishMutation?: () => void };
  if (
    !["get", "head", "options"].includes(config.method ?? "get") &&
    !isAuthUrl(config.url) &&
    !trackedConfig.finishMutation
  ) {
    const pending = new Promise<void>((resolve) => {
      trackedConfig.finishMutation = resolve;
    });
    trackMutation(pending);
  }
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
  (r) => {
    (r.config as typeof r.config & { finishMutation?: () => void }).finishMutation?.();
    return r;
  },
  async (error) => {
    const status = error?.response?.status;
    const originalConfig = (error?.config ?? {}) as any;

    if (status === 401 && !originalConfig._retry && !isAuthUrl(originalConfig.url)) {
      const epoch = getAuthEpoch();
      originalConfig._retry = true;
      try {
        const token = await runRefresh();
        originalConfig.headers = originalConfig.headers ?? {};
        originalConfig.headers.Authorization = `Bearer ${token}`;
        return api(originalConfig);
      } catch (refreshError) {
        originalConfig.finishMutation?.();
        if (isSessionRejected(refreshError) && epoch === getAuthEpoch()) {
          clearToken();
          window.dispatchEvent(new Event("auth:logout"));
        }
        (refreshError as any).friendlyMessage = getErrorMessage(
          refreshError,
          isSessionRejected(refreshError)
            ? "Сессия истекла. Войдите снова."
            : "Не удалось восстановить соединение. Повторите попытку.",
        );
        return Promise.reject(refreshError);
      }
    }

    originalConfig.finishMutation?.();

    if (
      status === 401 &&
      originalConfig._retry &&
      !isAuthUrl(originalConfig.url) &&
      originalConfig.headers?.Authorization === `Bearer ${getToken()}`
    ) {
      clearToken();
      window.dispatchEvent(new Event("auth:logout"));
    }
    (error as any).friendlyMessage = getErrorMessage(error, "Ошибка при запросе к серверу");
    return Promise.reject(error);
  },
);

export async function refreshSession(): Promise<string> {
  return runRefresh();
}

export async function selectRestaurant(restaurantId: number): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await withSessionLock(async () => {
        const epoch = getAuthEpoch();
        const { data } = await refreshClient.post(
          "/api/auth/switch-restaurant",
          { restaurantId },
          {
            headers: { Authorization: `Bearer ${getToken()}` },
          },
        );
        if (getAuthEpoch() !== epoch) throw new Error("Session changed");
        if (!data?.token) throw new Error("No token in switch response");
        saveToken(data.token);
        return data.token as string;
      });
    } catch (error) {
      if (attempt || !isSessionRejected(error)) throw error;
      await refreshSession();
    }
  }
  throw new Error("Could not select restaurant");
}

export default api;
