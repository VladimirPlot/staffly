import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchRestaurantName } from "../../restaurants/api";

export default function RestaurantHome() {
  const { user } = useAuth();
  const [name, setName] = React.useState<string>("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (user?.restaurantId) {
        try {
          const n = await fetchRestaurantName(user.restaurantId);
          if (alive) setName(n);
        } catch {
          if (alive) setName("");
        }
      }
    })();
    return () => { alive = false; };
  }, [user?.restaurantId]);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-4">
        <div className="text-sm text-zinc-500">Ресторан</div>
        <h2 className="text-2xl font-semibold">{name || "…"}</h2>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/employees/invite"
          className="block rounded-3xl border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="text-lg font-semibold">Участники</div>
          <div className="mt-1 text-sm text-zinc-600">
            Приглашайте сотрудников и назначайте роли/позиции.
          </div>
        </Link>

        <Link to="/training/categories" className="block">
          <Card className="h-full hover:bg-zinc-50">
            <div className="text-lg font-medium mb-1">Тренинг</div>
            <div className="text-sm text-zinc-600">Категории и позиции меню/бара</div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
