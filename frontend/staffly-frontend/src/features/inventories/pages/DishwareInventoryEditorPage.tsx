import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, MessageSquareText, Pencil, Save, SquareActivity, Trash2, Undo2 } from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import DishwareInventorySummary from "../components/DishwareInventorySummary";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import DishwareInventoryItemsTable, {
  type DishwareInventoryTableItem,
} from "../components/DishwareInventoryItemsTable";
import {
  completeDishwareInventory,
  deleteDishwareItemImage,
  getDishwareInventory,
  reopenDishwareInventory,
  trashDishwareInventory,
  updateDishwareInventory,
  uploadDishwareItemImage,
  type DishwareInventoryDto,
} from "../api";
import { computeDishwareSummary, getInventoryStatusBadgeClass } from "../utils";

type EditableDishwareItem = DishwareInventoryTableItem & { sortOrder?: number };

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
    setItems((prev) =>
      prev.filter((item) => item.clientId !== clientId).map((item, index) => ({ ...item, sortOrder: index })),
    );
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
      folderId: inventory?.folderId ?? null,
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
  }, [applyLoadedInventory, comment, inventory?.folderId, inventoryId, inventoryDate, items, restaurantId, title]);

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
      await trashDishwareInventory(restaurantId, Number(inventoryId));
      navigate("/inventories/dishware");
    } catch (e) {
      console.error("Failed to delete inventory", e);
    } finally {
      setDeleting(false);
    }
  }, [inventoryId, navigate, restaurantId]);

  const handleUploadImage = useCallback(
    async (itemId: number, file: File) => {
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
    },
    [inventoryId, mergeItemPhotoFromServer, restaurantId],
  );

  const handleDeleteImage = useCallback(
    async (itemId: number) => {
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
    },
    [inventoryId, mergeItemPhotoFromServer, restaurantId],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="text-muted text-sm">Загружаем инвентаризацию…</Card>
      </div>
    );
  }

  if (error || !inventory) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="text-sm text-red-600">{error ?? "Инвентаризация не найдена"}</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
        <Button variant="outline" onClick={() => navigate("/inventories/dishware")}>
          Назад к списку
        </Button>
      </div>

      <Card className="space-y-3 rounded-[1.5rem] p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_170px_156px_auto] xl:items-end">
          <Input
            label="Название"
            labelClassName="mb-0.5 text-xs font-medium"
            className="h-9 rounded-xl px-3"
            value={title}
            maxLength={200}
            disabled={isEditingLocked}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            label="Дата инвентаризации"
            labelClassName="mb-0.5 text-xs font-medium"
            className="h-9 rounded-xl px-3"
            type="date"
            value={inventoryDate}
            disabled={isEditingLocked}
            onChange={(event) => setInventoryDate(event.target.value)}
          />
          <div className="min-w-0">
            <div className="text-muted mb-0.5 flex items-center gap-1.5 text-xs font-medium">
              <Icon icon={SquareActivity} size="xs" decorative className="text-icon shrink-0 opacity-60" />
              <span>Статус</span>
            </div>
            <div className={getInventoryStatusBadgeClass(inventory.status) + " h-9 justify-start rounded-xl text-sm"}>
              <Icon
                icon={inventory.status === "COMPLETED" ? Check : Pencil}
                size="xs"
                decorative
                className={inventory.status === "COMPLETED" ? "shrink-0 text-emerald-600" : "text-icon shrink-0"}
              />
              <span>{inventory.status === "COMPLETED" ? "Завершена" : "Черновик"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
            {!isCompleted ? (
              <>
                <Button
                  size="sm"
                  className="min-h-11"
                  leftIcon={<Icon icon={Save} size="sm" decorative />}
                  isLoading={saving}
                  onClick={() => void handleSave()}
                >
                  Сохранить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  isLoading={saving}
                  leftIcon={<Icon icon={Check} size="sm" decorative />}
                  onClick={() => void handleComplete()}
                >
                  Завершить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 text-red-600"
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  disabled={saving}
                  onClick={() => setDeleteOpen(true)}
                >
                  В корзину
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                isLoading={saving}
                leftIcon={<Icon icon={Undo2} size="sm" decorative />}
                onClick={() => void handleReopen()}
              >
                Вернуть в черновик
              </Button>
            )}
          </div>
        </div>

        <details className="group border-subtle rounded-2xl border bg-[color:var(--staffly-control)]/30">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 transition outline-none hover:bg-[color:var(--staffly-control-hover)] focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] [&::-webkit-details-marker]:hidden">
            <span className="text-default flex min-w-0 items-center gap-2 text-sm font-medium">
              <Icon icon={MessageSquareText} size="sm" decorative className="text-icon shrink-0" />
              <span className="truncate">{comment.trim() ? "Комментарий к документу" : "Комментарий не добавлен"}</span>
            </span>
            <span className="text-muted text-xs">{comment.length}/5000</span>
          </summary>
          <div className="border-subtle border-t px-3 pt-2 pb-3">
            <Textarea
              label="Комментарий"
              labelClassName="sr-only"
              className="min-h-20 rounded-xl px-3 py-2"
              value={comment}
              maxLength={5000}
              disabled={isEditingLocked}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="Например: сверка по смене, залу или ответственному."
            />
          </div>
        </details>

        {inventory.sourceInventoryTitle ? (
          <div className="text-muted text-xs">Источник: {inventory.sourceInventoryTitle}</div>
        ) : null}

        {isCompleted ? (
          <div className="text-muted rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2 text-sm">
            Документ зафиксирован. Чтобы внести изменения, сначала верни его в черновик.
          </div>
        ) : null}
        {saveError ? <div className="text-sm text-red-600">{saveError}</div> : null}
      </Card>

      <DishwareInventorySummary summary={summary} />

      <DishwareInventoryItemsTable
        items={items}
        uploadingItemId={uploadingItemId}
        readOnly={isEditingLocked}
        saving={saving}
        onAddItem={addItem}
        onChange={updateItem}
        onRemove={removeItem}
        onUploadImage={(itemId, file) => void handleUploadImage(itemId, file)}
        onDeleteImage={(itemId) => void handleDeleteImage(itemId)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Переместить в корзину"
        description="Документ исчезнет из активного списка. В корзине его можно восстановить или удалить навсегда."
        confirming={deleting}
        confirmText={deleting ? "Перемещаем…" : "В корзину"}
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
