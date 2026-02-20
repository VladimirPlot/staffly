import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import ContentText from "../../../shared/ui/ContentText";
import IconButton from "../../../shared/ui/IconButton";
import Switch from "../../../shared/ui/Switch";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Icon from "../../../shared/ui/Icon";
import ImageCropperModal from "../../../shared/ui/ImageCropperModal";

import {
  listCategories,
  listItems,
  createItem,
  deleteItem,
  hideItem,
  restoreItem,
  uploadItemImage,
  deleteItemImage,
  updateItem,
  type TrainingCategoryDto,
  type TrainingItemDto,
} from "../api";
import { getTrainingModuleConfig, isConfigWithCategories } from "../config";
import { toAbsoluteUrl } from "../../../shared/utils/url";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import useActionMenu from "../../../shared/hooks/useActionMenu";
import { exportCroppedImageToFile } from "../../../shared/lib/imageCrop/canvasExport";
import { isAllowedMimeType, pickOutputMimeType, supportsWebp, TRAINING_ALLOWED_MIME_TYPES } from "../../../shared/lib/imageCrop/mime";
import type { CropFrame } from "../../../shared/lib/imageCrop/types";

import { Pencil, Image as ImageIcon } from "lucide-react";

const REQUIRED_MESSAGE = "Обязательное поле";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TRAINING_CROP_FRAME: CropFrame = { shape: "roundedRect", frameWidth: 280, frameHeight: 210, borderRadius: 24 };

type Params = { module: string; categoryId: string };

export default function TrainingCategoryItemsPage() {
  const params = useParams<Params>();
  const { restaurantId, canManage } = useTrainingAccess();
  const moduleConfig = getTrainingModuleConfig(params.module);
  const hasCategories = isConfigWithCategories(moduleConfig);
  const categoryId = Number(params.categoryId);
  const hasValidCategoryId = Boolean(params.categoryId) && !Number.isNaN(categoryId);
  const moduleCode = hasCategories ? moduleConfig.module : "MENU";

  const [category, setCategory] = useState<TrainingCategoryDto | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(true);

  const [items, setItems] = useState<TrainingItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [composition, setComposition] = useState("");
  const [description, setDescription] = useState("");
  const [allergens, setAllergens] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropBusy, setCropBusy] = useState(false);
  const [cropSourceImageUrl, setCropSourceImageUrl] = useState<string | null>(null);
  const [cropSourceFileName, setCropSourceFileName] = useState<string>("image");
  const [cropTarget, setCropTarget] = useState<{ mode: "create" } | { mode: "edit"; itemId: number } | null>(null);
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

  const { getActionsKey, toggleMenu, closeMenu } = useActionMenu<number>({
    openId: openActionsItemId,
    setOpenId: setOpenActionsItemId,
    scope: "item",
  });

  useEffect(() => {
    setIncludeInactive(false);
  }, [moduleCode, categoryId]);

  useEffect(() => () => {
    if (cropSourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSourceImageUrl);
    }
  }, [cropSourceImageUrl]);

  const loadCategory = useCallback(async () => {
    if (!restaurantId || !hasCategories || !hasValidCategoryId) return;
    setCategoryLoading(true);
    setCategoryError(null);
    try {
      const data = await listCategories(restaurantId, moduleCode, {
        includeInactive: includeInactive && canManage,
      });
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
  }, [
    restaurantId,
    hasCategories,
    hasValidCategoryId,
    moduleCode,
    canManage,
    categoryId,
    includeInactive,
  ]);

  const loadItems = useCallback(async () => {
    if (!restaurantId || !hasValidCategoryId) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const data = await listItems(restaurantId, categoryId, {
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
      setItems(sorted);
    } catch (e: any) {
      setItemsError(e?.friendlyMessage || "Не удалось загрузить карточки");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [restaurantId, hasValidCategoryId, categoryId, includeInactive, canManage]);

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

  const validateImageFile = (file: File | null) => {
    if (!file) return false;
    if (file.size > MAX_IMAGE_BYTES) {
      alert("Фото больше 2MB");
      return false;
    }
    if (!isAllowedMimeType(file.type, TRAINING_ALLOWED_MIME_TYPES)) {
      alert("Разрешены только JPG, PNG или WEBP");
      return false;
    }
    return true;
  };

  const resetCropModal = useCallback(() => {
    if (cropSourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSourceImageUrl);
    }
    setCropModalOpen(false);
    setCropBusy(false);
    setCropSourceImageUrl(null);
    setCropSourceFileName("image");
    setCropTarget(null);
  }, [cropSourceImageUrl]);

  const openCropForFile = useCallback((file: File, target: { mode: "create" } | { mode: "edit"; itemId: number }) => {
    if (!validateImageFile(file)) return;
    if (cropSourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSourceImageUrl);
    }
    setCropSourceImageUrl(URL.createObjectURL(file));
    setCropSourceFileName(file.name);
    setCropTarget(target);
    setCropModalOpen(true);
  }, [cropSourceImageUrl]);

  const handleConfirmCrop = useCallback(async ({ croppedAreaPixels }: { croppedAreaPixels: { x: number; y: number; width: number; height: number } }) => {
    if (!restaurantId || !cropSourceImageUrl || !cropTarget) return;
    setCropBusy(true);
    try {
      const { file } = await exportCroppedImageToFile({
        imageSrc: cropSourceImageUrl,
        crop: croppedAreaPixels,
        exportOptions: {
          outputWidth: 1200,
          outputHeight: 900,
          mimeType: pickOutputMimeType({
            supportsWebp: supportsWebp(),
            backendAllowsWebp: true,
            fallback: "image/jpeg",
          }),
          quality: 0.9,
          baseFileName: cropSourceFileName,
        },
      });

      if (cropTarget.mode === "create") {
        setImageFile(file);
      } else {
        setImageMutatingId(cropTarget.itemId);
        await uploadItemImage(restaurantId, cropTarget.itemId, file);
        await loadItems();
        setImageMutatingId(null);
      }
      resetCropModal();
    } catch (e: any) {
      alert(e?.friendlyMessage || "Не удалось обработать фото");
      setCropBusy(false);
      if (cropTarget.mode === "edit") {
        setImageMutatingId(null);
      }
    }
  }, [cropSourceFileName, cropSourceImageUrl, cropTarget, loadItems, resetCropModal, restaurantId]);

  const handleCreate = async () => {
    if (!restaurantId || !hasValidCategoryId || !name.trim() || !composition.trim()) return;
    try {
      setCreating(true);
      const nextSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1) + 1;
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

  const triggerImagePicker = (itemId: number) => {
    if (imageMutatingId === itemId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.[0] ?? null;
      if (file) {
        openCropForFile(file, { mode: "edit", itemId });
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

  const handleDeleteItem = async (itemId: number, itemName: string) => {
    if (!restaurantId) return;
    closeMenu();
    if (!confirm(`Удалить карточку «${itemName}» навсегда?`)) return;
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
    closeMenu();
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
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-2xl font-semibold text-strong">{category.name}</div>
              {category.description && (
                <ContentText className="mt-1 text-sm text-muted">{category.description}</ContentText>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.currentTarget.checked)}
                  label="Показать скрытые"
                />
                <Button onClick={() => setShowCreateForm((prev) => !prev)}>
                  {showCreateForm ? "Скрыть форму" : "Создать карточку"}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Card>

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
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    openCropForFile(file, { mode: "create" });
                  } else {
                    setImageFile(null);
                  }
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Выберите файл
                </Button>
                <span className="text-sm text-muted">{imageFile ? imageFile.name : "Файл не выбран"}</span>
              </div>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={handleCreate} disabled={creating || !name.trim() || !composition.trim()}>
              {creating ? "Создаём…" : "Создать"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Отмена
            </Button>
          </div>
        </Card>
      )}

      <Card className="!p-[8px] sm:!p-4">
        {itemsLoading ? (
          <div className="text-sm text-muted">Загрузка карточек…</div>
        ) : itemsError ? (
          <div className="text-red-600">{itemsError}</div>
        ) : items.length === 0 ? (
          <div className="text-muted">В этой категории пока нет карточек.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:gap-4">
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              const imageMutating = imageMutatingId === item.id;
              const actionsOpen = openActionsItemId === item.id;
              const isActive = item.active !== false;

              return (
                <Card
                  key={item.id}
                  className={[
                    "relative flex h-full flex-col overflow-hidden p-0",
                    isActive ? "" : "opacity-60",
                  ].join(" ")}
                >
                  {/* ✅ Карандаш/меню действий теперь не зависит от наличия картинки */}
                  {canManage && !isEditing && (
                    <div
                      data-actions
                      className="absolute right-2 top-2 z-40"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        aria-label="Действия с карточкой"
                        data-actions
                        data-actions-trigger={getActionsKey(item.id)}
                        className="
                          !h-10 !w-10 !p-0
                          !bg-[color-mix(in_srgb,var(--staffly-surface)_35%,transparent)]
                          !border-[color-mix(in_srgb,var(--staffly-border)_55%,transparent)]
                          backdrop-blur-sm
                        "
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(item.id);
                        }}
                      >
                        <Icon icon={Pencil} size="md" decorative />
                      </IconButton>
                    </div>
                  )}

                  {/* ✅ Фото/плейсхолдер одинаковой высоты */}
                  {item.imageUrl ? (
                    <div className="relative p-[0px]">
                      <div className="overflow-hidden rounded-3xl">
                        <img
                          src={toAbsoluteUrl(item.imageUrl)}
                          alt={item.name}
                          className="h-56 w-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 pt-3 sm:px-4 sm:pt-4">
                      <div
                        className="
                          group flex h-28 w-full flex-col items-center justify-center
                          rounded-3xl border border-dashed border-subtle
                          bg-gradient-to-br from-surface to-surface/70
                          transition
                        "
                      >
                        <div className="flex items-center justify-center rounded-full bg-surface/80 p-3 shadow-sm">
                          <Icon icon={ImageIcon} size="lg" className="text-muted" decorative />
                        </div>

                        <span className="mt-2 text-sm text-muted">
                          Фото не добавлено
                        </span>

                        {canManage && !isEditing && (
                          <span className="mt-1 text-xs text-muted opacity-70">
                            Нажмите карандаш, чтобы добавить
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {!isActive && (
                    <span className="absolute left-0.5 top-0.5 z-30 rounded-full border border-subtle bg-surface px-2.5 py-1 text-xs font-semibold text-default shadow-sm">
                      Скрыта
                    </span>
                  )}

                  {canManage && actionsOpen && !isEditing && (
                    <div
                      data-actions
                      data-actions-menu={getActionsKey(item.id)}
                      className="absolute right-2 top-14 z-40 flex w-60 flex-col gap-2 rounded-2xl border border-subtle bg-surface p-3 shadow-[var(--staffly-shadow)]"
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="outline" onClick={() => startEditItem(item)}>
                        Редактировать карточку
                      </Button>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!restaurantId) return;
                          closeMenu();
                          try {
                            if (item.active === false) {
                              await restoreItem(restaurantId, item.id);
                            } else {
                              await hideItem(restaurantId, item.id);
                            }
                            await loadItems();
                          } catch (e: any) {
                            alert(e?.friendlyMessage || "Не удалось обновить карточку");
                          }
                        }}
                      >
                        {item.active === false ? "Раскрыть карточку" : "Скрыть карточку"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        disabled={deletingItemId === item.id}
                      >
                        {deletingItemId === item.id ? "Удаляем…" : "Удалить навсегда"}
                      </Button>
                    </div>
                  )}

                  <div className="flex-1 px-3 py-3 sm:px-4 sm:py-4">
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

                        {canManage && (
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
                      </div>
                    ) : (
                      <>
                        <div className="text-lg font-semibold text-strong">{item.name}</div>

                        {item.description && (
                          <ContentText className="mt-1 text-sm text-muted">{item.description}</ContentText>
                        )}

                        <div className="mt-3">
                          <div className="text-xs uppercase tracking-wide text-muted">Состав</div>
                          <ContentText className="mt-1 text-sm text-default">
                            {item.composition || "Не указан"}
                          </ContentText>
                        </div>

                        {item.allergens && (
                          <div className="mt-3">
                            <div className="text-xs uppercase tracking-wide text-muted">Аллергены</div>
                            <ContentText className="mt-1 text-sm text-default">{item.allergens}</ContentText>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <ImageCropperModal
        open={cropModalOpen}
        title="Кадрирование фото"
        description="Подгоните изображение под карточку 4:3"
        imageUrl={cropSourceImageUrl}
        frame={TRAINING_CROP_FRAME}
        busy={cropBusy}
        onCancel={resetCropModal}
        onConfirm={({ croppedAreaPixels }) => void handleConfirmCrop({ croppedAreaPixels })}
      />
    </div>
  );
}
