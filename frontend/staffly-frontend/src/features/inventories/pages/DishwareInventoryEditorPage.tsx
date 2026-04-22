import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pencil, Save, SquareActivity, Trash2, Undo2 } from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DishwareInventoryItemCard from "../components/DishwareInventoryItemCard";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import DishwareInventorySummary from "../components/DishwareInventorySummary";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import {
  completeDishwareInventory,
  deleteDishwareInventory,
  deleteDishwareItemImage,
  getDishwareInventory,
  reopenDishwareInventory,
  updateDishwareInventory,
  uploadDishwareItemImage,
  type DishwareInventoryDto,
  type UpdateDishwareInventoryItemRequest,
} from "../api";
import { computeDishwareSummary, getInventoryStatusBadgeClass } from "../utils";

type EditableDishwareItem = Omit<UpdateDishwareInventoryItemRequest, "id" | "incomingQty"> & {
  clientId: string;
  id?: number;
  photoUrl?: string | null;
  incomingQty: number;
};

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toEditableItems(inventory: DishwareInventoryDto): EditableDishwareItem[] {
  return inventory.items.map((item, index) => ({
    clientId: String(item.id ?? createClientId()),
    id: item.id,
    name: item.name,
    photoUrl: item.photoUrl ?? null,
    previousQty: item.previousQty,
    incomingQty: item.incomingQty ?? 0,
    currentQty: item.currentQty,
    unitPrice: item.unitPrice ?? null,
    sortOrder: item.sortOrder ?? index,
    note: item.note ?? null,
  }));
}

function findServerItemById(inventory: DishwareInventoryDto, itemId: number) {
  return inventory.items.find((item) => item.id === itemId) ?? null;
}

function AuthorizedDishwareInventoryEditorPage() {
  const { inventoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [inventory, setInventory] = useState<DishwareInventoryDto | null>(null);
  const [title, setTitle] = useState("");
  const [inventoryDate, setInventoryDate] = useState("");
  const [comment, setComment] = useState("");
  const [items, setItems] = useState<EditableDishwareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);

  const loadInventory = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDishwareInventory(restaurantId, Number(inventoryId));
      setInventory(data);
      setTitle(data.title);
      setInventoryDate(data.inventoryDate);
      setComment(data.comment ?? "");
      setItems(toEditableItems(data));
    } catch (e) {
      console.error("Failed to load inventory", e);
      setError("Не удалось загрузить инвентаризацию");
    } finally {
      setLoading(false);
    }
  }, [inventoryId, restaurantId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const summary = useMemo(() => {
    return computeDishwareSummary(items);
  }, [items]);
  const isCompleted = inventory?.status === "COMPLETED";
  const isEditingLocked = isCompleted || saving;

  const updateItem = useCallback((clientId: string, patch: Partial<EditableDishwareItem>) => {
    setItems((prev) => prev.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        clientId: createClientId(),
        name: "",
        photoUrl: null,
        previousQty: 0,
        incomingQty: 0,
        currentQty: 0,
        unitPrice: null,
        sortOrder: prev.length,
        note: null,
      },
    ]);
  }, []);

  const removeItem = useCallback((clientId: string) => {
    setItems((prev) => prev.filter((item) => item.clientId !== clientId).map((item, index) => ({ ...item, sortOrder: index })));
  }, []);

  const mergeItemPhotoFromServer = useCallback((updatedInventory: DishwareInventoryDto, itemId: number) => {
    const serverItem = findServerItemById(updatedInventory, itemId);
    setInventory(updatedInventory);
    if (!serverItem) {
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              photoUrl: serverItem.photoUrl ?? null,
            }
          : item,
      ),
    );
  }, []);

  const applyLoadedInventory = useCallback((data: DishwareInventoryDto) => {
    setInventory(data);
    setTitle(data.title);
    setInventoryDate(data.inventoryDate);
    setComment(data.comment ?? "");
    setItems(toEditableItems(data));
  }, []);

  const saveDraft = useCallback(async () => {
    if (!restaurantId || !inventoryId) {
      return null;
    }

    const saved = await updateDishwareInventory(restaurantId, Number(inventoryId), {
      title,
      inventoryDate,
      comment,
      items: items.map((item, index) => ({
        id: item.id,
        name: item.name,
        previousQty: Number(item.previousQty) || 0,
        incomingQty: Number(item.incomingQty) || 0,
        currentQty: Number(item.currentQty) || 0,
        unitPrice: item.unitPrice == null ? null : Number(item.unitPrice),
        sortOrder: index,
        note: item.note ?? null,
      })),
    });
    applyLoadedInventory(saved);
    return saved;
  }, [applyLoadedInventory, comment, inventoryId, inventoryDate, items, restaurantId, title]);

  const handleSave = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveDraft();
    } catch (e: any) {
      console.error("Failed to save inventory", e);
      setSaveError(e?.friendlyMessage || "Не удалось сохранить инвентаризацию");
    } finally {
      setSaving(false);
    }
  }, [inventoryId, restaurantId, saveDraft]);

  const handleComplete = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveDraft();
      const completed = await completeDishwareInventory(restaurantId, Number(inventoryId));
      applyLoadedInventory(completed);
    } catch (e: any) {
      console.error("Failed to complete inventory", e);
      setSaveError(e?.friendlyMessage || "Не удалось завершить инвентаризацию");
    } finally {
      setSaving(false);
    }
  }, [applyLoadedInventory, inventoryId, restaurantId, saveDraft]);

  const handleReopen = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const reopened = await reopenDishwareInventory(restaurantId, Number(inventoryId));
      applyLoadedInventory(reopened);
    } catch (e: any) {
      console.error("Failed to reopen inventory", e);
      setSaveError(e?.friendlyMessage || "Не удалось вернуть документ в черновик");
    } finally {
      setSaving(false);
    }
  }, [applyLoadedInventory, inventoryId, restaurantId]);

  const handleDelete = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setDeleting(true);
    try {
      await deleteDishwareInventory(restaurantId, Number(inventoryId));
      navigate("/inventories/dishware");
    } catch (e) {
      console.error("Failed to delete inventory", e);
    } finally {
      setDeleting(false);
    }
  }, [inventoryId, navigate, restaurantId]);

  const handleUploadImage = useCallback(async (itemId: number, file: File) => {
    if (!restaurantId || !inventoryId) return;
    setUploadingItemId(itemId);
    setSaveError(null);
    try {
      const updated = await uploadDishwareItemImage(restaurantId, Number(inventoryId), itemId, file);
      mergeItemPhotoFromServer(updated, itemId);
    } catch (e: any) {
      console.error("Failed to upload item image", e);
      setSaveError(e?.friendlyMessage || "Не удалось загрузить фото");
    } finally {
      setUploadingItemId(null);
    }
  }, [inventoryId, mergeItemPhotoFromServer, restaurantId]);

  const handleDeleteImage = useCallback(async (itemId: number) => {
    if (!restaurantId || !inventoryId) return;
    setUploadingItemId(itemId);
    setSaveError(null);
    try {
      const updated = await deleteDishwareItemImage(restaurantId, Number(inventoryId), itemId);
      mergeItemPhotoFromServer(updated, itemId);
    } catch (e: any) {
      console.error("Failed to delete item image", e);
      setSaveError(e?.friendlyMessage || "Не удалось удалить фото");
    } finally {
      setUploadingItemId(null);
    }
  }, [inventoryId, mergeItemPhotoFromServer, restaurantId]);

  if (loading) {
    return <div className="mx-auto max-w-4xl"><Card className="text-sm text-muted">Загружаем инвентаризацию…</Card></div>;
  }

  if (error || !inventory) {
    return <div className="mx-auto max-w-4xl"><Card className="text-sm text-red-600">{error ?? "Инвентаризация не найдена"}</Card></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
        <Button variant="outline" onClick={() => navigate("/inventories/dishware")}>
          Назад к списку
        </Button>
      </div>

      <Card className="space-y-3 rounded-[1.75rem] p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Название"
                labelClassName="mb-0.5 text-xs font-medium"
                className="h-9 rounded-xl px-3"
                value={title}
                maxLength={200}
                disabled={isEditingLocked}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <Input
              label="Дата инвентаризации"
              labelClassName="mb-0.5 text-xs font-medium"
              className="h-9 rounded-xl px-3"
              type="date"
              value={inventoryDate}
              disabled={isEditingLocked}
              onChange={(event) => setInventoryDate(event.target.value)}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Комментарий"
                labelClassName="mb-0.5 text-xs font-medium"
                className="rounded-xl px-3 py-2.5"
                value={comment}
                maxLength={5000}
                disabled={isEditingLocked}
                onChange={(event) => setComment(event.target.value)}
                rows={2}
              />
            </div>
            {inventory.sourceInventoryTitle ? (
              <div className="sm:col-span-2 text-xs text-muted">Источник: {inventory.sourceInventoryTitle}</div>
            ) : null}
          </div>

          <div className="space-y-2 rounded-2xl border border-subtle bg-app px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Icon icon={SquareActivity} size="xs" decorative className="shrink-0 text-icon opacity-60" />
              <div>Статус</div>
            </div>
            <div className={getInventoryStatusBadgeClass(inventory.status) + " text-sm"}>
              <Icon
                icon={inventory.status === "COMPLETED" ? Check : Pencil}
                size="xs"
                decorative
                className={inventory.status === "COMPLETED" ? "shrink-0 text-emerald-600" : "shrink-0 text-icon"}
              />
              <span>{inventory.status === "COMPLETED" ? "Завершена" : "Черновик"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {!isCompleted ? (
            <>
              <Button size="sm" leftIcon={<Icon icon={Save} size="sm" decorative />} isLoading={saving} onClick={() => void handleSave()}>
                Сохранить
              </Button>
              <Button
                size="sm"
                variant="outline"
                isLoading={saving}
                leftIcon={<Icon icon={Check} size="sm" decorative />}
                onClick={() => void handleComplete()}
              >
                Завершить инвентаризацию
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                disabled={saving}
                onClick={() => setDeleteOpen(true)}
              >
                Удалить документ
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              isLoading={saving}
              leftIcon={<Icon icon={Undo2} size="sm" decorative />}
              onClick={() => void handleReopen()}
            >
              Вернуть в черновик
            </Button>
          )}
        </div>

        {isCompleted ? (
          <div className="text-sm text-muted">
            Документ зафиксирован. Чтобы внести изменения, сначала верни его в черновик.
          </div>
        ) : null}
        {saveError ? <div className="text-sm text-red-600">{saveError}</div> : null}
      </Card>

      <DishwareInventorySummary summary={summary} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Позиции</h3>
          <div className="text-sm text-muted">Было / Приход / Стало</div>
        </div>
        {!isCompleted ? (
          <Button size="sm" disabled={saving} onClick={addItem}>
            Добавить позицию
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <DishwareInventoryItemCard
            key={item.clientId}
            item={item}
            index={index}
            uploading={uploadingItemId === item.id}
            readOnly={isEditingLocked}
            onChange={updateItem}
            onRemove={removeItem}
            onUploadImage={(itemId, file) => void handleUploadImage(itemId, file)}
            onDeleteImage={(itemId) => void handleDeleteImage(itemId)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Удалить инвентаризацию"
        description="Документ и все его строки будут удалены. Уже созданные на его основе копии не изменятся."
        confirming={deleting}
        confirmText={deleting ? "Удаляем…" : "Удалить"}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function DishwareInventoryEditorPage() {
  return (
    <InventoryAccessGuard>
      <AuthorizedDishwareInventoryEditorPage />
    </InventoryAccessGuard>
  );
}
