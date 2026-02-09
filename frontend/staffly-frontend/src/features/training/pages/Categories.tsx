import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Switch from "../../../shared/ui/Switch";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  hideCategory,
  restoreCategory,
  type TrainingCategoryDto,
  type TrainingModule,
} from "../api";
import {
  getTrainingModuleConfig,
  isConfigWithCategories,
  type TrainingModuleConfig,
} from "../config";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import TrainingCategoryCard from "../components/TrainingCategoryCard";

function BreadcrumbsBlock({ module }: { module: TrainingModuleConfig }) {
  return (
    <Breadcrumbs
      items={[
        { label: "Тренинг", to: "/training" },
        { label: module.title },
      ]}
      className="mb-3"
    />
  );
}

function ServiceStub({ module }: { module: TrainingModuleConfig }) {
  return (
    <div className="mx-auto max-w-3xl">
      <BreadcrumbsBlock module={module} />
      <Card>
        <div className="text-lg font-semibold">{module.title}</div>
        <div className="mt-2 text-sm text-muted">
          Раздел находится в разработке. Скоро здесь появятся материалы по сервису.
        </div>
      </Card>
    </div>
  );
}

function TrainingModuleCategoriesPage() {
  const params = useParams<{ module: string }>();
  const { restaurantId, canManage } = useTrainingAccess();
  const moduleConfig = getTrainingModuleConfig(params.module);
  const hasCategories = isConfigWithCategories(moduleConfig);
  const moduleCode: TrainingModule = hasCategories ? moduleConfig.module : "MENU";

  const [categories, setCategories] = useState<TrainingCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [includeInactive, setIncludeInactive] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryDescription, setEditCategoryDescription] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    if (!hasCategories) return;
    setIncludeInactive(false);
  }, [hasCategories, moduleCode]);

  const load = useCallback(async () => {
    if (!restaurantId || !hasCategories) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories(restaurantId, moduleCode, {
        includeInactive: includeInactive && canManage,
      });
      const sorted = [...data].sort((a, b) => {
        const activeOrder = Number(b.active !== false) - Number(a.active !== false);
        if (activeOrder !== 0) return activeOrder;
        const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });
      setCategories(sorted);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки категорий");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, hasCategories, moduleCode, includeInactive, canManage]);

  useEffect(() => {
    if (restaurantId) void load();
  }, [restaurantId, load]);

  const handleCreate = useCallback(async () => {
    if (!restaurantId || !hasCategories || !name.trim()) return;
    try {
      setCreating(true);
      const nextSortOrder =
        categories.reduce((max, category) => Math.max(max, category.sortOrder ?? 0), -1) + 1;
      await createCategory(restaurantId, moduleCode, {
        name,
        description: description.trim() || null,
        sortOrder: nextSortOrder,
      });
      setName("");
      setDescription("");
      setShowCreateForm(false);
      await load();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Ошибка создания категории");
    } finally {
      setCreating(false);
    }
  }, [restaurantId, hasCategories, moduleCode, name, description, load, categories]);

  if (!moduleConfig) {
    return <Navigate to="/training" replace />;
  }

  if (!hasCategories) {
    return <ServiceStub module={moduleConfig} />;
  }

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-3xl">
        <BreadcrumbsBlock module={moduleConfig} />
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <BreadcrumbsBlock module={moduleConfig} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{moduleConfig.title}</h2>
          <div className="mt-1 text-sm text-muted">{moduleConfig.description}</div>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.currentTarget.checked)}
              label="Показать скрытые"
            />
            <Button onClick={() => setShowCreateForm((prev) => !prev)}>
              {showCreateForm ? "Скрыть форму" : "Создать категорию"}
            </Button>
          </div>
        )}
      </div>

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
          <div className="text-sm text-muted">Загрузка…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : categories.length === 0 ? (
          <div className="text-sm text-muted">Категории пока не созданы.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((category) => (
              <TrainingCategoryCard
                key={category.id}
                category={category}
                moduleConfig={moduleConfig}
                canManage={canManage}
                isEditing={editingCategoryId === category.id}
                editName={editCategoryName}
                editDescription={editCategoryDescription}
                saving={savingCategory}
                onStartEdit={() => {
                  setEditingCategoryId(category.id);
                  setEditCategoryName(category.name);
                  setEditCategoryDescription(category.description ?? "");
                }}
                onCancelEdit={() => {
                  setEditingCategoryId(null);
                  setEditCategoryName("");
                  setEditCategoryDescription("");
                }}
                onSaveEdit={async () => {
                  if (!restaurantId) return;
                  const trimmedName = editCategoryName.trim();
                  if (!trimmedName) {
                    alert("Название не может быть пустым");
                    return;
                  }
                  try {
                    setSavingCategory(true);
                    await updateCategory(restaurantId, category.id, {
                      name: trimmedName,
                      description: editCategoryDescription.trim()
                        ? editCategoryDescription.trim()
                        : null,
                      sortOrder: category.sortOrder ?? 0,
                      active: category.active ?? true,
                    });
                    setEditingCategoryId(null);
                    await load();
                  } catch (e: any) {
                    alert(e?.friendlyMessage || "Ошибка сохранения");
                  } finally {
                    setSavingCategory(false);
                  }
                }}
                onEditNameChange={(value) => setEditCategoryName(value)}
                onEditDescriptionChange={(value) => setEditCategoryDescription(value)}
                onToggleActive={async () => {
                  if (!restaurantId) return;
                  try {
                    if (category.active === false) {
                      await restoreCategory(restaurantId, category.id);
                    } else {
                      await hideCategory(restaurantId, category.id);
                    }
                    await load();
                  } catch (e: any) {
                    alert(e?.friendlyMessage || "Ошибка обновления категории");
                  }
                }}
                onDelete={async () => {
                  if (!restaurantId) return;
                  if (!confirm(`Удалить категорию «${category.name}» навсегда?`)) return;
                  try {
                    await deleteCategory(restaurantId, category.id);
                    await load();
                  } catch (e: any) {
                    alert(e?.friendlyMessage || "Ошибка удаления категории");
                  }
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default TrainingModuleCategoriesPage;
