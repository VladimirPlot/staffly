import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { switchRestaurant } from "../../auth/api";

export default function PushRedirectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user, refreshMe } = useAuth();
  const [status, setStatus] = React.useState("Перенаправляем…");

  React.useEffect(() => {
    const to = searchParams.get("to") || "/inbox";
    const ridParam = searchParams.get("rid");
    const midParam = searchParams.get("mid");
    const target = midParam ? `${to}?mid=${midParam}` : to;

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const rid = ridParam ? Number(ridParam) : null;
    if (!rid || user?.restaurantId === rid) {
      navigate(target, { replace: true });
      return;
    }

    void (async () => {
      try {
        setStatus("Переключаем ресторан…");
        await switchRestaurant(rid);
        await refreshMe();
      } catch (e) {
        console.error("Failed to switch restaurant for push redirect", e);
      } finally {
        navigate(target, { replace: true });
      }
    })();
  }, [navigate, refreshMe, searchParams, token, user?.restaurantId]);

  return <div className="p-6 text-sm text-zinc-600">{status}</div>;
}
