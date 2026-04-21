import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ImagePlus, Save, Trash2, Undo2 } from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import {
  deleteDishwareInventory,
  deleteDishwareItemImage,
  getDishwareInventory,
  updateDishwareInventory,
  uploadDishwareItemImage,
  type DishwareInventoryDto,
  type DishwareInventoryStatus,
  type UpdateDishwareInventoryItemRequest,
} from "../api";

type EditableDishwareItem = Omit<UpdateDishwareInventoryItemRequest, "id"> & {
  clientId: string;
  id?: number;
  photoUrl?: string | null;
};

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function toEditableItems(inventory: DishwareInventoryDto): EditableDishwareItem[] {
  return inventory.items.map((item, index) => ({
    clientId: String(item.id ?? createClientId()),
    id: item.id,
    name: item.name,
    photoUrl: item.photoUrl ?? null,
    previousQty: item.previousQty,
    currentQty: item.currentQty,
    unitPrice: item.unitPrice ?? null,
    sortOrder: item.sortOrder ?? index,
    note: item.note ?? null,
  }));
}

function findServerItemById(inventory: DishwareInventoryDto, itemId: number) {
  return inventory.items.find((item) => item.id === itemId) ?? null;
}

export default function DishwareInventoryEditorPage() {
  const { inventoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [inventory, setInventory] = useState<DishwareInventoryDto | null>(null);
  const [title, setTitle] = useState("");
  const [inventoryDate, setInventoryDate] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<DishwareInventoryStatus>("DRAFT");
  const [items, setItems] = useState<EditableDishwareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const fileInputsRef = useRef<Map<string, HTMLInputElement | null>>(new Map());

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
      setStatus(data.status);
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
    let totalLossQty = 0;
    let totalLossAmount = 0;
    for (const item of items) {
      const lossQty = Math.max((item.previousQty ?? 0) - (item.currentQty ?? 0), 0);
      totalLossQty += lossQty;
      if (item.unitPrice != null && lossQty > 0) {
        totalLossAmount += Number(item.unitPrice) * lossQty;
      }
    }

    return {
      itemsCount: items.length,
      totalLossQty,
      totalLossAmount,
    };
  }, [items]);

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

  const handleSave = useCallback(async (nextStatus?: DishwareInventoryStatus) => {
    if (!restaurantId || !inventoryId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateDishwareInventory(restaurantId, Number(inventoryId), {
        title,
        inventoryDate,
        status: nextStatus ?? status,
        comment,
        items: items.map((item, index) => ({
          id: item.id,
          name: item.name,
          previousQty: Number(item.previousQty) || 0,
          currentQty: Number(item.currentQty) || 0,
          unitPrice: item.unitPrice == null ? null : Number(item.unitPrice),
          sortOrder: index,
          note: item.note ?? null,
        })),
      });
      setInventory(saved);
      setTitle(saved.title);
      setInventoryDate(saved.inventoryDate);
      setComment(saved.comment ?? "");
      setStatus(saved.status);
      setItems(toEditableItems(saved));
    } catch (e: any) {
      console.error("Failed to save inventory", e);
      setSaveError(e?.friendlyMessage || "Не удалось сохранить инвентаризацию");
    } finally {
      setSaving(false);
    }
  }, [comment, inventoryId, inventoryDate, items, restaurantId, status, title]);

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
    return <div className="mx-auto max-w-5xl"><Card className="text-sm text-muted">Загружаем инвентаризацию…</Card></div>;
  }

  if (error || !inventory) {
    return <div className="mx-auto max-w-5xl"><Card className="text-sm text-red-600">{error ?? "Инвентаризация не найдена"}</Card></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
        <Button variant="outline" onClick={() => navigate("/inventories/dishware")}>
          Назад к списку
        </Button>
      </div>

      <Card className="space-y-4 rounded-[2rem]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 lg:max-w-2xl">
            <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input label="Дата инвентаризации" type="date" value={inventoryDate} onChange={(event) => setInventoryDate(event.target.value)} />
            <Textarea label="Комментарий" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
            {inventory.sourceInventoryTitle ? (
              <div className="text-sm text-muted">Создана по образцу: {inventory.sourceInventoryTitle}</div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 lg:min-w-[260px]">
            <div className="bg-app rounded-2xl px-3 py-2">
              <div className="text-xs text-muted">Позиции</div>
              <div className="font-semibold">{summary.itemsCount}</div>
            </div>
            <div className="bg-app rounded-2xl px-3 py-2">
              <div className="text-xs text-muted">Потеряно шт</div>
              <div className="font-semibold">{summary.totalLossQty}</div>
            </div>
            <div className="bg-app col-span-2 rounded-2xl px-3 py-2">
              <div className="text-xs text-muted">Сумма потерь</div>
              <div className="font-semibold">{formatMoney(summary.totalLossAmount)}</div>
            </div>
            <div className="col-span-2 text-xs text-muted">
              Статус: {status === "COMPLETED" ? "Завершена" : "Черновик"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button leftIcon={<Icon icon={Save} size="sm" decorative />} isLoading={saving} onClick={() => void handleSave()}>
            Сохранить
          </Button>
          <Button
            variant="outline"
            isLoading={saving}
            leftIcon={<Icon icon={Undo2} size="sm" decorative />}
            onClick={() => void handleSave(status === "COMPLETED" ? "DRAFT" : "COMPLETED")}
          >
            {status === "COMPLETED" ? "Вернуть в черновик" : "Завершить инвентаризацию"}
          </Button>
          <Button
            variant="outline"
            className="text-red-600"
            leftIcon={<Icon icon={Trash2} size="sm" decorative />}
            onClick={() => setDeleteOpen(true)}
          >
            Удалить документ
          </Button>
        </div>

        {saveError ? <div className="text-sm text-red-600">{saveError}</div> : null}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Позиции</h3>
          <div className="text-sm text-muted">Для новых строк фото станет доступно сразу после сохранения документа.</div>
        </div>
        <Button onClick={addItem}>Добавить позицию</Button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const lossQty = Math.max((item.previousQty ?? 0) - (item.currentQty ?? 0), 0);
          const lossAmount = item.unitPrice != null ? Number(item.unitPrice) * lossQty : 0;
          return (
            <Card key={item.clientId} className="space-y-4 rounded-[2rem] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-muted">Позиция #{index + 1}</div>
                <Button variant="outline" className="text-red-600" onClick={() => removeItem(item.clientId)}>
                  Удалить строку
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="bg-app flex aspect-square items-center justify-center overflow-hidden rounded-[1.5rem]">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name || "Фото позиции"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-4 text-center text-sm text-muted">Фото не добавлено</div>
                    )}
                  </div>
                  <input
                    ref={(node) => { fileInputsRef.current.set(item.clientId, node); }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file || !item.id) return;
                      void handleUploadImage(item.id, file);
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      leftIcon={<Icon icon={ImagePlus} size="sm" decorative />}
                      disabled={!item.id || uploadingItemId === item.id}
                      onClick={() => fileInputsRef.current.get(item.clientId)?.click()}
                    >
                      {item.photoUrl ? "Заменить фото" : "Добавить фото"}
                    </Button>
                    {item.photoUrl && item.id ? (
                      <Button
                        variant="outline"
                        className="text-red-600"
                        disabled={uploadingItemId === item.id}
                        onClick={() => void handleDeleteImage(item.id ?? 0)}
                      >
                        Удалить фото
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Название"
                    value={item.name}
                    onChange={(event) => updateItem(item.clientId, { name: event.target.value })}
                  />
                  <Input
                    label="Цена за шт"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice ?? ""}
                    onChange={(event) => updateItem(item.clientId, {
                      unitPrice: event.target.value === "" ? null : Number(event.target.value),
                    })}
                  />
                  <Input
                    label="Было"
                    type="number"
                    min={0}
                    value={String(item.previousQty ?? 0)}
                    onChange={(event) => updateItem(item.clientId, { previousQty: Number(event.target.value) || 0 })}
                  />
                  <Input
                    label="Стало"
                    type="number"
                    min={0}
                    value={String(item.currentQty ?? 0)}
                    onChange={(event) => updateItem(item.clientId, { currentQty: Number(event.target.value) || 0 })}
                  />
                  <div className="bg-app rounded-2xl px-4 py-3">
                    <div className="text-xs text-muted">Разница</div>
                    <div className="text-base font-semibold">{(item.currentQty ?? 0) - (item.previousQty ?? 0)}</div>
                  </div>
                  <div className="bg-app rounded-2xl px-4 py-3">
                    <div className="text-xs text-muted">Недостача</div>
                    <div className="text-base font-semibold">{formatMoney(lossAmount)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Заметка"
                      value={item.note ?? ""}
                      onChange={(event) => updateItem(item.clientId, { note: event.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
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
