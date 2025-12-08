import axios from "axios";
import { getToken /*, clearToken*/ } from "../utils/storage";
import { API_BASE } from "../utils/url";

const api = axios.create({
  baseURL: API_BASE,
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
