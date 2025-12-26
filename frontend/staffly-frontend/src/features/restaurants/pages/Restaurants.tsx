import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import { loadMyRestaurants } from "../api";
import { switchRestaurant } from "../../auth/api";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import {
  fetchMyInvites,
  acceptInvite,
  declineInvite,
  type MyInvite,
} from "../../invitations/api";

export default function Restaurants() {
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [restaurants, setRestaurants] = React.useState<
    Array<{ id: number; name: string; city?: string; role: string }>
  >([]);
  const [invites, setInvites] = React.useState<MyInvite[]>([]);

  const { refreshMe, user } = useAuth();
  const isCreator = !!user?.roles?.includes("CREATOR");

  // Единая функция загрузки
  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, my] = await Promise.all([
        loadMyRestaurants(),
        fetchMyInvites(),
      ]);
      setRestaurants(list);
      setInvites(my);
    } catch {
      setRestaurants([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Грузим, когда профиль пользователя появился/сменился
  React.useEffect(() => {
    if (!user) return;
    void reload();
  }, [user?.id, reload]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Выбор ресторана</h2>
              <p className="text-sm text-zinc-600">Загружаем ваши рестораны…</p>
            </div>
            <div className="animate-pulse rounded-full border border-zinc-300 px-3 py-1 text-xs">
              Загрузка
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Выбор ресторана</h2>
            <p className="text-sm text-zinc-600">
              Выберите ресторан для работы. Позже добавим поиск и фильтры.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reload}>
              Обновить
            </Button>
            {isCreator && (
              <Button
                variant="outline"
                onClick={() => navigate("/restaurants/new")}
              >
                Создать ресторан
              </Button>
            )}
          </div>
        </div>

        {invites.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 text-sm font-medium">У вас есть приглашения:</div>

            <div className="grid gap-2">
              {invites.map((inv) => (
                <div
                  key={inv.token}
                  className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">
                      <span className="font-medium">{inv.restaurantName}</span>
                      {" · роль: "}
                      {inv.desiredRole}
                      {inv.positionName ? ` · позиция: ${inv.positionName}` : ""}
                    </div>
                    <div className="text-xs text-zinc-500">
                      истекает: {new Date(inv.expiresAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={async () => {
                        try {
                      await acceptInvite(inv.token);
                      await switchRestaurant(inv.restaurantId);
                      await refreshMe();
                      navigate("/app", { replace: true });
                    } catch (e: any) {
                      alert(
                        e?.friendlyMessage || "Не удалось принять приглашение"
                      );
                    }
                  }}
                >
                  Принять
                    </Button>

                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={async () => {
                      try {
                        await declineInvite(inv.token);
                        setInvites((prev) =>
                          prev.filter((x) => x.token !== inv.token)
                        );
                      } catch (e: any) {
                        alert(
                          e?.friendlyMessage || "Не удалось отклонить"
                        );
                      }
                    }}
                  >
                    Отклонить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {restaurants.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4 hover:bg-zinc-50"
            >
              <div>
                <div className="text-sm text-zinc-500">#{r.id}</div>
                <div className="text-lg font-medium">{r.name}</div>
                <div className="text-sm text-zinc-600">
                  {(r.city || "") + " · Роль: " + r.role}
                </div>
              </div>
              <Button
                onClick={async () => {
                  await switchRestaurant(r.id);
                  await refreshMe();
                  navigate("/app", { replace: true });
                }}
              >
                Открыть
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
