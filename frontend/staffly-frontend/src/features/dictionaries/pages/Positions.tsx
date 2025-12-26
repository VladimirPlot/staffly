import React from "react";
import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  type PositionDto,
  type RestaurantRole,
} from "../api";

const ROLE_LABEL: Record<RestaurantRole, string> = {
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  STAFF: "Сотрудник",
};

export default function PositionsPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [items, setItems] = React.useState<PositionDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // форма создания
  const [name, setName] = React.useState("");
  const [level, setLevel] = React.useState<RestaurantRole>("STAFF");
  const [creating, setCreating] = React.useState(false);

  // NEW: показывать ли неактивные
  const [showInactive, setShowInactive] = React.useState(false);

  // Показываем UI всем, а права проверит бэкенд (403 при отсутствии прав).
  const canManage = true;

  const load = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPositions(restaurantId, { includeInactive: showInactive });
      setItems(data);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, showInactive]);

  React.useEffect(() => {
    if (restaurantId) void load();
  }, [restaurantId, load]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
        <BackToHome className="text-sm" />
        <Link
          to="/employees/invite"
          className="inline-flex items-center text-zinc-700 hover:underline"
        >
          ← Сотрудники
        </Link>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Должности</h2>
        <div className="flex items-center gap-3">
          {/* NEW: переключатель показа неактивных */}
          <label className="flex select-none items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Показать неактивные
          </label>
          <Button onClick={load} variant="outline">Обновить</Button>
        </div>
      </div>

      {/* Создание */}
      <Card className="mb-4">
        <div className="mb-3 text-sm font-medium">Добавить должность</div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Официант"
          />
          <label className="block text-sm sm:w-56">
            <span className="mb-1 block text-zinc-600">Уровень</span>
            <select
              className="w-full rounded-2xl border border-zinc-300 p-3 outline-none transition focus:ring-2 focus:ring-zinc-300"
              value={level}
              onChange={(e) => setLevel(e.target.value as RestaurantRole)}
            >
              <option value="STAFF">Сотрудник</option>
              <option value="MANAGER">Менеджер</option>
              <option value="ADMIN">Админ</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || creating || !canManage}
              onClick={async () => {
                if (!name.trim()) return;
                try {
                  setCreating(true);
                  await createPosition(restaurantId, { name, level });
                  setName("");
                  setLevel("STAFF");
                  await load();
                } catch (e: any) {
                  alert(e?.friendlyMessage || "Ошибка создания");
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Создаём…" : "Создать"}
            </Button>
          </div>
        </div>
        {!canManage && (
          <div className="mt-2 text-xs text-zinc-500">
            У вас нет прав на создание должностей (нужен MANAGER или ADMIN).
          </div>
        )}
      </Card>

      {/* Список */}
      <Card>
        {loading ? (
          <div>Загрузка…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-zinc-600">Пока нет должностей.</div>
        ) : (
          <div className="divide-y">
            {items.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-medium">{p.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                    <span className="rounded-full border px-2 py-0.5">
                      {ROLE_LABEL[p.level]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        p.active
                          ? "border border-emerald-300 text-emerald-700"
                          : "border border-zinc-300 text-zinc-600"
                      }`}
                    >
                      {p.active ? "Активна" : "Отключена"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Переключить активность */}
                  <Button
                    variant="outline"
                    disabled={!canManage}
                    onClick={async () => {
                      try {
                        await updatePosition(restaurantId, p.id, {
                          active: !p.active,  // обязательно
                          name: p.name,       // не теряем имя
                          level: p.level,     // и уровень
                        });
                        await load();
                      } catch (e: any) {
                        alert(e?.friendlyMessage || "Ошибка обновления");
                      }
                    }}
                  >
                    {p.active ? "Отключить" : "Включить"}
                  </Button>

                  {/* Переименовать */}
                  <Button
                    variant="outline"
                    disabled={!canManage}
                    onClick={async () => {
                      const newName = prompt("Новое название должности:", p.name)?.trim();
                      if (!newName || newName === p.name) return;
                      try {
                        await updatePosition(restaurantId, p.id, {
                          name: newName,
                          level: p.level,
                          active: p.active, // обязателен
                        });
                        await load();
                      } catch (e: any) {
                        alert(e?.friendlyMessage || "Ошибка переименования");
                      }
                    }}
                  >
                    Переименовать
                  </Button>

                  {/* Удалить (де-факто деактивация на бэке) */}
                  <Button
                    variant="ghost"
                    disabled={!canManage}
                    onClick={async () => {
                      if (!confirm(`Удалить должность «${p.name}»?`)) return;
                      try {
                        await deletePosition(restaurantId, p.id);
                        await load();
                      } catch (e: any) {
                        alert(e?.friendlyMessage || "Ошибка удаления");
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
