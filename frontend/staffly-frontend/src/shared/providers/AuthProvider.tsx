import React from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, getToken, saveToken } from "../utils/storage";
import { me as apiMe } from "../../features/auth/api";
import type { MeResponse } from "../../entities/user/types";

export type UiUser = {
  id: number;
  phone: string;
  name: string;
  roles?: string[];
  avatarUrl?: string;
  restaurantId?: number | null;
};

export type AuthContextValue = {
  token: string | null;
  user: UiUser | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

export const AuthContext = React.createContext<AuthContextValue | null>(null);

// 👇 базовый URL бэкенда и хелпер абсолютных ссылок
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") as string) ||
  "http://localhost:8080";

const toAbsoluteUrl = (url?: string | null) => {
  if (!url) return undefined;
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `${API_BASE}${url}`;
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = React.useState<string | null>(getToken());
  const [user, setUser] = React.useState<UiUser | null>(null);
  const [loading, setLoading] = React.useState<boolean>(!!token);

  const toUiUser = (m: MeResponse): UiUser => {
    const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
    return {
      id: m.userId,
      phone: m.phone,
      name: fullName || (m.isCreator ? "Создатель" : "Пользователь"),
      roles: m.roles,
      avatarUrl: toAbsoluteUrl(m.avatarUrl), // ✅ делаем абсолютным
      restaurantId: m.restaurantId ?? null,
    };
  };

  const refreshMe = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const me = await apiMe();
      setUser(toUiUser(me));
    } catch (e) {
      console.error("/api/me failed", e);
      clearToken();
      setToken(null);
      setUser(null);
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  const loginWithToken = React.useCallback(
    async (newToken: string) => {
      saveToken(newToken);
      setToken(newToken);
      await refreshMe();
      navigate("/restaurants", { replace: true });
    },
    [refreshMe, navigate]
  );

  const logout = React.useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  React.useEffect(() => {
    if (token) void refreshMe();
  }, [token, refreshMe]);

  return (
    <AuthContext.Provider value={{ token, user, loading, loginWithToken, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
