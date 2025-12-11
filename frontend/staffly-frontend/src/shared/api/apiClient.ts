import axios from "axios";
import { getToken /*, clearToken*/ } from "../utils/storage";
import { API_BASE } from "../utils/url";
import { getErrorMessage } from "../utils/errors";

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

// Глобальная обработка ошибок
api.interceptors.response.use(
  (r) => r,
  (error) => {
    // прикручиваем "дружественное" сообщение
    (error as any).friendlyMessage = getErrorMessage(error, "Ошибка при запросе к серверу");
    return Promise.reject(error);
  }
);

export default api;
