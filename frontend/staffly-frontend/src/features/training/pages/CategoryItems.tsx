import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import ContentText from "../../../shared/ui/ContentText";
import IconButton from "../../../shared/ui/IconButton";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  listCategories,
  listItems,
  createItem,
  deleteItem,
  uploadItemImage,
  deleteItemImage,
  updateItem,
  type TrainingCategoryDto,
  type TrainingItemDto,
} from "../api";
import { getTrainingModuleConfig, isConfigWithCategories } from "../config";
import { toAbsoluteUrl } from "../../../shared/utils/url";
import { getMyRoleIn } from "../../../shared/api/memberships";
import { hasTrainingManagementAccess } from "../../../shared/utils/access";
import type { RestaurantRole } from "../../../shared/types/restaurant";

import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Icon from "../../../shared/ui/Icon";
import { Pencil } from "lucide-react";

const REQUIRED_MESSAGE = "Обязательное поле";

type Params = { module: string; categoryId: string };

export default function TrainingCategoryItemsPage() {
  const params = useParams<Params>();
  const { user } = useAuth();
  const moduleConfig = getTrainingModuleConfig(params.module);
  const hasCategories = isConfigWithCategories(moduleConfig);
  const categoryId = Number(params.categoryId);
  const hasValidCategoryId = Boolean(params.categoryId) && !Number.isNaN(categoryId);
  const moduleCode = hasCategories ? moduleConfig.module : "MENU";
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);

  const canManage = useMemo(
    () => hasTrainingManagementAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  useEffect(() => {
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

  const [category, setCategory] = useState<TrainingCategoryDto | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(true);

  const [items, setItems] = useState<TrainingItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [composition, setComposition] = useState("");
  const [description, setDescription] = useState("");
  const [allergens, setAllergens] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imageMutatingId, setImageMutatingId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [openActionsItemId, setOpenActionsItemId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemComposition, setEditItemComposition] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemAllergens, setEditItemAllergens] = useState("");
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const loadCategory = useCallback(async () => {
    if (!restaurantId || !hasCategories || !hasValidCategoryId) return;
    setCategoryLoading(true);
    setCategoryError(null);
    try {
      const data = await listCategories(restaurantId, moduleCode, canManage);
      const found = data.find((c) => c.id === categoryId) ?? null;
      if (!found) {
        setCategoryError("Категория не найдена или недоступна.");
        setCategory(null);
      } else {
        setCategory(found);
      }
    } catch (e: any) {
      setCategoryError(e?.friendlyMessage || "Не удалось загрузить категорию");
      setCategory(null);
    } finally {
      setCategoryLoading(false);
    }
  }, [restaurantId, hasCategories, hasValidCategoryId, moduleCode, canManage, categoryId]);

  const loadItems = useCallback(async () => {
    if (!restaurantId || !hasValidCategoryId) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const data = await listItems(restaurantId, categoryId);
      const sorted = [...data].sort((a, b) => {
        const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });
      setItems(sorted);
    } catch (e: any) {
      setItemsError(e?.friendlyMessage || "Не удалось загрузить карточки");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [restaurantId, hasValidCategoryId, categoryId]);

  useEffect(() => {
    if (!restaurantId) return;
    void loadCategory();
    void loadItems();
  }, [restaurantId, loadCategory, loadItems]);

  const resetForm = () => {
    setName("");
    setComposition("");
    setDescription("");
    setAllergens("");
    setImageFile(null);
    setShowCreateForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreate = async () => {
    if (!restaurantId || !hasValidCategoryId || !name.trim() || !composition.trim()) return;
    try {
      setCreating(true);
      const nextSortOrder =
        items.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1) + 1;
      const created = await createItem(restaurantId, {
        categoryId,
        name,
        composition,
        description: description.trim() ? description.trim() : null,
        allergens: allergens.trim() ? allergens.trim() : null,
        sortOrder: nextSortOrder,
      });
      if (imageFile) {
        try {
          await uploadItemImage(restaurantId, created.id, imageFile);
        } catch (e: any) {
          alert(e?.friendlyMessage || "Не удалось загрузить фото");
        }
      }
      resetForm();
      await loadItems();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Не удалось создать карточку");
    } finally {
      setCreating(false);
    }
  };

  const handleUploadImage = async (itemId: number, file: File | null) => {
    if (!restaurantId || !file) return;
    try {
      setImageMutatingId(itemId);
      await uploadItemImage(restaurantId, itemId, file);
      await loadItems();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Не удалось загрузить фото");
    } finally {
      setImageMutatingId(null);
    }
  };

  const triggerImagePicker = (itemId: number) => {
    if (imageMutatingId === itemId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.[0] ?? null;
      if (file) {
        void handleUploadImage(itemId, file);
      }
    };
    input.click();
  };

  const handleDeleteImage = async (itemId: number) => {
    if (!restaurantId) return;
    try {
      setImageMutatingId(itemId);
      await deleteItemImage(restaurantId, itemId);
      await loadItems();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Не удалось удалить фото");
    } finally {
      setImageMutatingId(null);
    }
  };

  const handleDeleteItem = async (itemId: number, name: string) => {
    if (!restaurantId) return;
    setOpenActionsItemId(null);
    if (!confirm(`Удалить карточку «${name}»?`)) return;
    try {
      setDeletingItemId(itemId);
      await deleteItem(restaurantId, itemId);
      await loadItems();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Не удалось удалить карточку");
    } finally {
      setDeletingItemId(null);
    }
  };

  const startEditItem = (item: TrainingItemDto) => {
    setOpenActionsItemId(null);
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemComposition(item.composition ?? "");
    setEditItemDescription(item.description ?? "");
    setEditItemAllergens(item.allergens ?? "");
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditItemName("");
    setEditItemComposition("");
    setEditItemDescription("");
    setEditItemAllergens("");
    setSavingItemId(null);
  };

  const handleSaveItem = async (item: TrainingItemDto) => {
    if (!restaurantId) return;
    const trimmedName = editItemName.trim();
    const trimmedComposition = editItemComposition.trim();
    if (!trimmedName || !trimmedComposition) {
      alert("Название и состав не могут быть пустыми");
      return;
    }
    try {
      setSavingItemId(item.id);
      await updateItem(restaurantId, item.id, {
        name: trimmedName,
        composition: trimmedComposition,
        description: editItemDescription.trim() ? editItemDescription.trim() : null,
        allergens: editItemAllergens.trim() ? editItemAllergens.trim() : null,
        sortOrder: item.sortOrder ?? 0,
        active: item.active ?? true,
      });
      cancelEditItem();
      await loadItems();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Не удалось сохранить карточку");
    } finally {
      setSavingItemId(null);
    }
  };

  if (!moduleConfig || !hasCategories) {
    return <Navigate to="/training" replace />;
  }

  if (!hasValidCategoryId) {
    return <Navigate to={`/training/${moduleConfig.slug}`} replace />;
  }

  if (!restaurantId) {
    return <Navigate to="/training" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumbs
        className="mb-3"
        homeTo="/app"
        items={[
          { label: "Тренинг", to: "/training" },
          { label: moduleConfig.title, to: `/training/${moduleConfig.slug}` },
          { label: category?.name ?? "Категория" },
        ]}
      />

      <Card className="mb-4">
        {categoryLoading ? (
          <div className="text-sm text-muted">Загрузка категории…</div>
        ) : categoryError ? (
          <div className="text-red-600">{categoryError}</div>
        ) : category ? (
          <div>
            <div className="text-2xl font-semibold text-strong">{category.name}</div>
            {category.description && (
              <ContentText className="mt-1 text-sm text-muted">{category.description}</ContentText>
            )}
          </div>
        ) : null}
      </Card>

      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Скрыть форму" : "Создать карточку"}
          </Button>
        </div>
      )}

      {canManage && showCreateForm && (
        <Card className="mb-4">
          <div className="mb-3 text-sm font-medium">Новая карточка</div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Цезарь"
              required
              error={!name.trim() && creating ? REQUIRED_MESSAGE : undefined}
            />
            <Textarea
              label="Состав"
              value={composition}
              onChange={(e) => setComposition(e.target.value)}
              placeholder="Курица, салат романо, соус цезарь"
              rows={3}
              required
              error={!composition.trim() && creating ? REQUIRED_MESSAGE : undefined}
            />
            <Textarea
              label="Описание (опционально)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <Textarea
              label="Аллергены (опционально)"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              rows={3}
            />
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Фото (опционально)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Выберите файл
                </Button>
                <span className="text-sm text-muted">
                  {imageFile ? imageFile.name : "Файл не выбран"}
                </span>
              </div>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !composition.trim()}
            >
              {creating ? "Создаём…" : "Создать"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
              }}
            >
              Отмена
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {itemsLoading ? (
          <div className="text-sm text-muted">Загрузка карточек…</div>
        ) : itemsError ? (
          <div className="text-red-600">{itemsError}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 text-muted">
            <div>В этой категории пока нет карточек.</div>
            {canManage && (
              <Button
                onClick={() => {
                  setShowCreateForm(true);
                }}
              >
                Создать карточку
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              const imageMutating = imageMutatingId === item.id;
              const actionsOpen = openActionsItemId === item.id;
              return (
                <Card key={item.id} className="relative flex h-full flex-col gap-3">
                  {canManage && !isEditing && (
                    <IconButton
                      aria-label="Действия с карточкой"
                      className="absolute right-3 top-3 h-9 w-9 p-0"
                      onClick={() => setOpenActionsItemId((prev) => (prev === item.id ? null : item.id))}
                    >
                      <Icon icon={Pencil} size="sm" decorative />
                    </IconButton>
                  )}
                  {canManage && actionsOpen && !isEditing && (
                    <div className="absolute right-3 top-14 z-10 flex w-60 flex-col gap-2 rounded-2xl border border-subtle bg-surface p-3 shadow-[var(--staffly-shadow)]">
                      <Button variant="outline" onClick={() => startEditItem(item)}>
                        Редактировать карточку
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        disabled={deletingItemId === item.id}
                      >
                        {deletingItemId === item.id ? "Удаляем…" : "Удалить карточку"}
                      </Button>
                    </div>
                  )}
                  {item.imageUrl && (
                    <img
                      src={toAbsoluteUrl(item.imageUrl)}
                      alt={item.name}
                      className="h-48 w-full rounded-2xl object-cover"
                    />
                  )}
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="grid gap-3">
                        <Input
                          label="Название"
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          autoFocus
                        />
                        <Textarea
                          label="Состав"
                          value={editItemComposition}
                          onChange={(e) => setEditItemComposition(e.target.value)}
                          rows={3}
                        />
                        <Textarea
                          label="Описание (опционально)"
                          value={editItemDescription}
                          onChange={(e) => setEditItemDescription(e.target.value)}
                          rows={3}
                        />
                        <Textarea
                          label="Аллергены (опционально)"
                          value={editItemAllergens}
                          onChange={(e) => setEditItemAllergens(e.target.value)}
                          rows={3}
                        />
                        <div className="rounded-2xl border border-dashed border-subtle p-3">
                          <div className="text-sm font-medium text-default">Фото</div>
                          <div className="mt-2 flex flex-col gap-2">
                            {item.imageUrl ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => triggerImagePicker(item.id)}
                                  disabled={imageMutating}
                                >
                                  {imageMutating ? "Обновляем…" : "Изменить фото"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleDeleteImage(item.id)}
                                  disabled={imageMutating}
                                >
                                  {imageMutating ? "Удаляем…" : "Удалить фото"}
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => triggerImagePicker(item.id)}
                                disabled={imageMutating}
                              >
                                {imageMutating ? "Загружаем…" : "Добавить фото"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-lg font-semibold text-strong">{item.name}</div>
                        {item.description && (
                          <ContentText className="mt-1 text-sm text-muted">{item.description}</ContentText>
                        )}
                        <div className="mt-3">
                          <div className="text-xs uppercase tracking-wide text-muted">
                            Состав
                          </div>
                          <ContentText className="mt-1 text-sm text-default">
                            {item.composition || "Не указан"}
                          </ContentText>
                        </div>
                        {item.allergens && (
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wide text-muted">
                              Аллергены
                            </div>
                            <ContentText className="mt-1 text-sm text-default">
                              {item.allergens}
                            </ContentText>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {canManage && isEditing && (
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSaveItem(item)}
                        disabled={savingItemId === item.id}
                      >
                        {savingItemId === item.id ? "Сохраняем…" : "Сохранить"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={cancelEditItem}
                        disabled={savingItemId === item.id}
                      >
                        Отмена
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
