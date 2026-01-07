import React from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, getToken, saveToken } from "../utils/storage";
import { logout as apiLogout, me as apiMe, refresh as apiRefresh } from "../../features/auth/api";
import type { MeResponse } from "../../entities/user/types";
import { toAbsoluteUrl } from "../utils/url";

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

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = React.useState<string | null>(getToken());
  const [user, setUser] = React.useState<UiUser | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  const toUiUser = (m: MeResponse): UiUser => {
    const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
    return {
      id: m.userId,
      phone: m.phone,
      name: fullName || (m.isCreator ? "Создатель" : "Пользователь"),
      roles: m.roles,
      avatarUrl: toAbsoluteUrl(m.avatarUrl),
      restaurantId: m.restaurantId ?? null,
    };
  };

  /**
   * Loads /api/me using current access token.
   * Important: token can be rotated by apiClient's auto-refresh, so we must read it again from storage after the call.
   */
  const refreshMe = React.useCallback(async () => {
    const t = getToken();
    if (!t) {
      setToken(null);
      setUser(null);
      return;
    }

    try {
      const me = await apiMe();
      setUser(toUiUser(me));
      setToken(getToken()); // ✅ актуальный токен после возможного refresh в interceptor
    } catch (e) {
      console.error("/api/me failed", e);
      clearToken();
      setToken(null);
      setUser(null);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

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
    void (async () => {
      try {
        await apiLogout();
      } catch (e) {
        console.warn("Logout failed", e);
      } finally {
        clearToken();
        setToken(null);
        setUser(null);
        setLoading(false);
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  React.useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        // 1) If we already have access token — try to load /me
        if (getToken()) {
          await refreshMe();
          return;
        }

        // 2) Otherwise try to restore session by refresh cookie
        try {
          await apiRefresh(); // saves new access token
        } catch {
          if (active) {
            clearToken();
            setToken(null);
            setUser(null);
          }
          return;
        }

        await refreshMe();
      } finally {
        if (active) setLoading(false);
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [refreshMe]);

  React.useEffect(() => {
    const handleLogout = () => {
      clearToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      navigate("/login", { replace: true });
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [navigate]);

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
