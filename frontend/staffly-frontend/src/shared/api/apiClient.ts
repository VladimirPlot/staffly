import axios from "axios";
import { getToken /*, clearToken*/ } from "../utils/storage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  withCredentials: false,
});

// Всегда подставляем Bearer из localStorage
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ВАЖНО: НЕ чистим токен тут. Пусть обработка 401 будет в AuthProvider.refreshMe()
api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Можно просто пробросить ошибку — AuthProvider сам разрулит редирект на /login
    return Promise.reject(error);
  }
);

export default api;
