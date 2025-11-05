import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { getMyRoleIn } from "../../../shared/api/memberships";
import { hasTrainingManagementAccess } from "../../../shared/utils/access";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type TrainingCategoryDto,
  type TrainingModule,
} from "../api";
import {
  getTrainingModuleConfig,
  isConfigWithCategories,
  type TrainingModuleConfig,
} from "../config";

function Breadcrumbs({ module }: { module: TrainingModuleConfig }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
      <BackToHome />
      <span>→</span>
      <Link to="/training" className="hover:underline">
        Тренинг
      </Link>
      <span>→</span>
      <span className="font-medium text-zinc-800">{module.title}</span>
    </div>
  );
}

function ServiceStub({ module }: { module: TrainingModuleConfig }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs module={module} />
      <Card>
        <div className="text-lg font-semibold">{module.title}</div>
        <div className="mt-2 text-sm text-zinc-600">
          Раздел находится в разработке. Скоро здесь появятся материалы по сервису.
        </div>
      </Card>
    </div>
  );
}

function TrainingModuleCategoriesPage() {
  const params = useParams<{ module: string }>();
  const moduleConfig = getTrainingModuleConfig(params.module);

  if (!moduleConfig) {
    return <Navigate to="/training" replace />;
  }

  if (!isConfigWithCategories(moduleConfig)) {
    return <ServiceStub module={moduleConfig} />;
  }

  const moduleCode: TrainingModule = moduleConfig.module;
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);

  const canManage = React.useMemo(
    () => hasTrainingManagementAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  React.useEffect(() => {
    if (restaurantId == null) {
      setMyRole(null);
      return;
    }

    if (hasTrainingManagementAccess(user?.roles)) {
      setMyRole(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const role = await getMyRoleIn(restaurantId);
        if (!cancelled) {
          setMyRole(role);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load membership role", error);
          setMyRole(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, user?.roles]);

  const [categories, setCategories] = React.useState<TrainingCategoryDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [allForManagers, setAllForManagers] = React.useState(false);

  React.useEffect(() => {
    setAllForManagers(false);
  }, [moduleCode]);

  const load = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories(restaurantId, moduleCode, allForManagers && canManage);
      setCategories(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Ошибка загрузки категорий");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, moduleCode, allForManagers, canManage]);

  React.useEffect(() => {
    if (restaurantId) void load();
  }, [restaurantId, moduleCode, load]);

  const handleCreate = React.useCallback(async () => {
    if (!restaurantId || !name.trim()) return;
    try {
      setCreating(true);
      await createCategory(restaurantId, moduleCode, {
        name,
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
      setShowCreateForm(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Ошибка создания категории");
    } finally {
      setCreating(false);
    }
  }, [restaurantId, moduleCode, name, description, load]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs module={moduleConfig} />
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumbs module={moduleConfig} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{moduleConfig.title}</h2>
          <div className="mt-1 text-sm text-zinc-600">{moduleConfig.description}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {canManage && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allForManagers}
                onChange={(e) => setAllForManagers(e.currentTarget.checked)}
              />
              Показать все категории
            </label>
          )}
          <Button variant="outline" onClick={load}>
            Обновить
          </Button>
        </div>
      </div>

      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Скрыть форму" : "Создать категорию"}
          </Button>
        </div>
      )}

      {canManage && showCreateForm && (
        <Card className="mb-4">
          <div className="mb-3 text-sm font-medium">Новая категория</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Салаты"
              autoFocus
            />
            <Input
              label="Описание (опционально)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание"
            />
            <div className="flex items-end gap-2">
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
              >
                {creating ? "Создаём…" : "Создать"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setName("");
                  setDescription("");
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div>Загрузка…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : categories.length === 0 ? (
          <div className="text-zinc-600">Категории пока не созданы.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((category) => (
              <Card key={category.id} className="flex h-full flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex-1">
                  <div className="text-lg font-semibold text-zinc-900">{category.name}</div>
                  {category.description && (
                    <div className="mt-1 text-sm text-zinc-600">{category.description}</div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                  <span className="rounded-full border border-emerald-200 px-2 py-0.5 uppercase">
                    {moduleCode === "MENU"
                      ? "Меню"
                      : moduleCode === "BAR"
                      ? "Бар"
                      : "Вино"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      category.active !== false
                        ? "border border-emerald-300 text-emerald-700"
                        : "border border-zinc-300 text-zinc-600"
                    }`}
                  >
                    {category.active !== false ? "Активна" : "Отключена"}
                  </span>
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Link to={`/training/${moduleConfig.slug}/categories/${category.id}`}>
                    <Button variant="outline">Открыть</Button>
                  </Link>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const newName = prompt("Новое название категории:", category.name)?.trim();
                          if (!newName || newName === category.name) return;
                          try {
                            await updateCategory(restaurantId, category.id, {
                              name: newName,
                              description: category.description ?? null,
                              sortOrder: category.sortOrder ?? 0,
                              active: category.active ?? true,
                            });
                            await load();
                          } catch (e: any) {
                            alert(
                              e?.response?.data?.message || e?.message || "Ошибка переименования"
                            );
                          }
                        }}
                      >
                        Переименовать
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await updateCategory(restaurantId, category.id, {
                              name: category.name,
                              description: category.description ?? null,
                              sortOrder: category.sortOrder ?? 0,
                              active: !(category.active ?? true),
                            });
                            await load();
                          } catch (e: any) {
                            alert(
                              e?.response?.data?.message || e?.message || "Ошибка смены статуса"
                            );
                          }
                        }}
                      >
                        {category.active !== false ? "Отключить" : "Включить"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (
                            !confirm(`Удалить (деактивировать) категорию «${category.name}»?`)
                          )
                            return;
                          try {
                            await deleteCategory(restaurantId, category.id);
                            await load();
                          } catch (e: any) {
                            alert(
                              e?.response?.data?.message || e?.message || "Ошибка удаления категории"
                            );
                          }
                        }}
                      >
                        Удалить
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default TrainingModuleCategoriesPage;
