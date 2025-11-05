import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type TrainingCategoryDto,
  type TrainingModule,
} from "../api";

export default function TrainingCategoriesPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  // По умолчанию работаем с MENU. Переключатель на BAR добавим потом.
  const [module, setModule] = React.useState<TrainingModule>("MENU");

  const [items, setItems] = React.useState<TrainingCategoryDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Форма создания
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Менеджерский флаг: показать ВСЕ категории, игнорируя видимость по позициям (бэк сам проверит права)
  const [allForManagers, setAllForManagers] = React.useState(false);

  // Разрешения UI: глобальный CREATOR — можно всё (иначе доверяем бэку)
  const canManage = Boolean(user?.roles?.includes("CREATOR"));

  const load = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories(restaurantId, module, allForManagers);
      setItems(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, module, allForManagers]);

  React.useEffect(() => {
    if (restaurantId) void load();
  }, [restaurantId, module, allForManagers, load]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
    <div className="mb-3"><BackToHome /></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Тренинг — Категории</h2>
        <div className="flex items-center gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Модуль</span>
            <select
              className="rounded-2xl border border-zinc-300 p-2"
              value={module}
              onChange={(e) => setModule(e.target.value as TrainingModule)}
            >
              <option value="MENU">Меню</option>
              <option value="BAR">Бар</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allForManagers}
              onChange={(e) => setAllForManagers(e.currentTarget.checked)}
            />
            Показать все (для менеджера)
          </label>
          <Button onClick={load} variant="outline">Обновить</Button>
        </div>
      </div>

      {/* Создание */}
      <Card className="mb-4">
        <div className="mb-3 text-sm font-medium">Добавить категорию</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Паста"
          />
          <Input
            label="Описание (опц.)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Короткое описание"
          />
          <div className="flex items-end">
            <Button
              disabled={!name.trim() || creating || !canManage}
              onClick={async () => {
                try {
                  setCreating(true);
                  await createCategory(restaurantId, module, {
                    name,
                    description: description.trim() || null,
                  });
                  setName("");
                  setDescription("");
                  await load();
                } catch (e: any) {
                  alert(e?.response?.data?.message || e?.message || "Ошибка создания");
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
            У вас может не быть прав на создание (нужен MANAGER или ADMIN). Бэкенд проверит.
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
          <div className="text-zinc-600">Пока нет категорий.</div>
        ) : (
          <div className="divide-y">
            {items.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-base font-medium">{c.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                    <span className="rounded-full border px-2 py-0.5">{c.module}</span>
                    <span className={`rounded-full px-2 py-0.5 ${
                      c.active !== false ? "border border-emerald-300 text-emerald-700" : "border border-zinc-300 text-zinc-600"
                    }`}>
                      {c.active !== false ? "Активна" : "Отключена"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!canManage}
                    onClick={async () => {
                      const newName = prompt("Новое название категории:", c.name)?.trim();
                      if (!newName || newName === c.name) return;
                      try {
                        await updateCategory(restaurantId, c.id, {
                          name: newName,
                          description: c.description ?? null,
                          sortOrder: c.sortOrder ?? 0,
                          active: c.active ?? true,
                        });
                        await load();
                      } catch (e: any) {
                        alert(e?.response?.data?.message || e?.message || "Ошибка переименования");
                      }
                    }}
                  >
                    Переименовать
                  </Button>

                  <Button
                    variant="outline"
                    disabled={!canManage}
                    onClick={async () => {
                      // Тогглим активность: на бэке deleteCategory тоже деактивирует,
                      // но тут дадим “мягкий” переключатель через update.
                      try {
                        await updateCategory(restaurantId, c.id, {
                          name: c.name,
                          description: c.description ?? null,
                          sortOrder: c.sortOrder ?? 0,
                          active: !(c.active ?? true),
                        });
                        await load();
                      } catch (e: any) {
                        alert(e?.response?.data?.message || e?.message || "Ошибка переключения активности");
                      }
                    }}
                  >
                    {c.active !== false ? "Отключить" : "Включить"}
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={!canManage}
                    onClick={async () => {
                      if (!confirm(`Удалить (деактивировать) категорию «${c.name}»?`)) return;
                      try {
                        await deleteCategory(restaurantId, c.id);
                        await load();
                      } catch (e: any) {
                        alert(e?.response?.data?.message || e?.message || "Ошибка удаления");
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
