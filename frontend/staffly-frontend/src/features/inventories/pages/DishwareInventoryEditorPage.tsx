import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  Download,
  MessageSquareText,
  Pencil,
  Printer,
  Save,
  SquareActivity,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";

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
import Modal from "../../../shared/ui/Modal";
import { useDishwareDraft } from "../hooks/useDishwareDraft";
import { dishwareDraftKey } from "../dishwareDraft";
import DishwareInventoryItemsTable from "../components/DishwareInventoryItemsTable";
import {
  completeDishwareInventory,
  deleteDishwareItemImage,
  downloadDishwareInventoryPrintForm,
  getDishwareInventory,
  getDishwareInventoryPrintFormHtml,
  reopenDishwareInventory,
  trashDishwareInventory,
  uploadDishwareItemImage,
  type DishwareInventoryDto,
} from "../api";
import {
  createEmptyDishwareInventoryItem,
  findDishwareServerItemById,
  type DishwareInventoryEditableItem,
} from "../dishwareInventoryItems";
import { downloadDishwareFile } from "../downloadDishwareFile";
import { getFriendlyInventoryError } from "../inventoryErrors";
import { openDishwareInventoryPrintWindow, printDishwareInventoryBlank } from "../printDishwareInventoryBlank";
import { computeDishwareSummary, getInventoryStatusBadgeClass } from "../utils";

type EditorActionButton = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
};

const actionButton = (
  label: string,
  icon: LucideIcon,
  onClick: () => void,
  options: Omit<EditorActionButton, "label" | "icon" | "onClick"> = {},
): EditorActionButton => ({ label, icon, onClick, ...options });

function getDishwareListPath(folderId: number | null | undefined): string {
  return folderId == null ? "/inventories/dishware" : `/inventories/dishware?folderId=${folderId}`;
}

function AuthorizedDishwareInventoryEditorPage() {
  const { inventoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [inventory, setInventory] = useState<DishwareInventoryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [downloadingPrintForm, setDownloadingPrintForm] = useState(false);
  const [printingPrintForm, setPrintingPrintForm] = useState(false);
  const [exitPending, setExitPending] = useState(false);
  const leaving = useRef(false);
  const draftKey =
    user && restaurantId && inventoryId ? dishwareDraftKey(user.id, restaurantId, Number(inventoryId)) : null;
  const editor = useDishwareDraft(
    draftKey,
    restaurantId,
    Number(inventoryId),
    saving || deleting || exitPending || uploadingItemId !== null,
  );
  const { draft, setDraft, initialize, discard } = editor;
  const { title, inventoryDate, comment, items } = draft;
  const setTitle = (value: string) => setDraft((prev) => ({ ...prev, title: value }));
  const setInventoryDate = (value: string) => setDraft((prev) => ({ ...prev, inventoryDate: value }));
  const setComment = (value: string) => setDraft((prev) => ({ ...prev, comment: value }));
  const setItems = useCallback(
    (action: (prev: DishwareInventoryEditableItem[]) => DishwareInventoryEditableItem[]) => {
      setDraft((prev) => ({ ...prev, items: action(prev.items) }));
    },
    [setDraft],
  );
  const blocker = useBlocker(
    () =>
      !leaving.current &&
      (editor.dirty || editor.busy || saving || uploadingItemId !== null || Boolean(editor.recovery)),
  );
  useEffect(() => {
    setExitPending(blocker.state === "blocked");
  }, [blocker.state]);

  const loadInventory = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDishwareInventory(restaurantId, Number(inventoryId));
      setInventory(data);
      initialize(data);
    } catch (e) {
      console.error("Failed to load inventory", e);
      setError("Не удалось загрузить инвентаризацию");
    } finally {
      setLoading(false);
    }
  }, [initialize, inventoryId, restaurantId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const summary = useMemo(() => {
    return computeDishwareSummary(items);
  }, [items]);
  const isCompleted = inventory?.status === "COMPLETED";
  const isEditingLocked = isCompleted || saving || exitPending || Boolean(editor.recovery);
  const dishwareListPath = useMemo(() => getDishwareListPath(inventory?.folderId), [inventory?.folderId]);

  const updateItem = useCallback(
    (clientId: string, patch: Partial<DishwareInventoryEditableItem>) => {
      setItems((prev) => prev.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
    },
    [setItems],
  );

  const addItem = useCallback(() => {
    const item = createEmptyDishwareInventoryItem(0);
    setItems((prev) => [...prev, { ...item, sortOrder: prev.length }]);
    return item.clientId;
  }, [setItems]);

  const removeItem = useCallback(
    (clientId: string) => {
      setItems((prev) =>
        prev.filter((item) => item.clientId !== clientId).map((item, index) => ({ ...item, sortOrder: index })),
      );
    },
    [setItems],
  );

  const mergeItemPhotoFromServer = useCallback(
    (updatedInventory: DishwareInventoryDto, itemId: number) => {
      const serverItem = findDishwareServerItemById(updatedInventory, itemId);
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
    },
    [setItems],
  );

  const applyLoadedInventory = useCallback(
    (data: DishwareInventoryDto) => {
      setInventory(data);
      initialize(data);
    },
    [initialize],
  );

  const saveDraft = editor.save;

  const runSaveAction = useCallback(
    async (
      action: (restaurantId: number, inventoryId: number) => Promise<unknown>,
      logMessage: string,
      fallbackMessage: string,
    ) => {
      if (!restaurantId || !inventoryId) return;
      const numericInventoryId = Number(inventoryId);
      setSaving(true);
      setSaveError(null);
      try {
        await action(restaurantId, numericInventoryId);
      } catch (e) {
        console.error(logMessage, e);
        setSaveError(getFriendlyInventoryError(e, e instanceof Error ? e.message : fallbackMessage));
      } finally {
        setSaving(false);
      }
    },
    [inventoryId, restaurantId],
  );

  const handleSave = useCallback(async () => {
    await runSaveAction(() => saveDraft(), "Failed to save inventory", "Не удалось сохранить инвентаризацию");
  }, [runSaveAction, saveDraft]);

  const handleComplete = useCallback(async () => {
    await runSaveAction(
      async (restaurantId, inventoryId) => {
        await saveDraft();
        const completed = await completeDishwareInventory(restaurantId, inventoryId);
        applyLoadedInventory(completed);
      },
      "Failed to complete inventory",
      "Не удалось завершить инвентаризацию",
    );
  }, [applyLoadedInventory, runSaveAction, saveDraft]);

  const handleReopen = useCallback(async () => {
    await runSaveAction(
      async (restaurantId, inventoryId) => {
        const reopened = await reopenDishwareInventory(restaurantId, inventoryId);
        applyLoadedInventory(reopened);
      },
      "Failed to reopen inventory",
      "Не удалось вернуть документ в черновик",
    );
  }, [applyLoadedInventory, runSaveAction]);

  const handleDownloadPrintForm = useCallback(async () => {
    if (!restaurantId || !inventoryId || saving || downloadingPrintForm) return;
    setDownloadingPrintForm(true);
    setSaveError(null);
    try {
      let downloadTitle = title;
      if (!isCompleted) {
        setSaving(true);
        const saved = await saveDraft();
        downloadTitle = saved?.title ?? downloadTitle;
      }
      const file = await downloadDishwareInventoryPrintForm(restaurantId, Number(inventoryId), downloadTitle);
      downloadDishwareFile(file.blob, file.fileName);
    } catch (e) {
      console.error("Failed to download inventory print form", e);
      setSaveError(getFriendlyInventoryError(e, "Не удалось скачать бланк"));
    } finally {
      setSaving(false);
      setDownloadingPrintForm(false);
    }
  }, [downloadingPrintForm, inventoryId, isCompleted, restaurantId, saveDraft, saving, title]);

  const handlePrintForm = useCallback(async () => {
    if (!restaurantId || !inventoryId || saving || printingPrintForm) return;

    let printWindow: Window;
    try {
      printWindow = openDishwareInventoryPrintWindow();
    } catch (e) {
      setSaveError(getFriendlyInventoryError(e, "Не удалось открыть окно печати"));
      return;
    }

    setPrintingPrintForm(true);
    setSaveError(null);
    try {
      if (!isCompleted) {
        setSaving(true);
        await saveDraft();
      }
      const printHtml = await getDishwareInventoryPrintFormHtml(restaurantId, Number(inventoryId));
      printDishwareInventoryBlank(printWindow, printHtml);
    } catch (e) {
      printWindow.close();
      console.error("Failed to print inventory form", e);
      setSaveError(getFriendlyInventoryError(e, "Не удалось подготовить бланк к печати"));
    } finally {
      setSaving(false);
      setPrintingPrintForm(false);
    }
  }, [inventoryId, isCompleted, printingPrintForm, restaurantId, saveDraft, saving]);

  const handleDelete = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setDeleting(true);
    try {
      await trashDishwareInventory(restaurantId, Number(inventoryId));
      discard();
      leaving.current = true;
      navigate(dishwareListPath);
    } catch (e) {
      console.error("Failed to delete inventory", e);
    } finally {
      setDeleting(false);
    }
  }, [discard, dishwareListPath, inventoryId, navigate, restaurantId]);

  const handleUploadImage = useCallback(
    async (itemId: number, file: File) => {
      if (!restaurantId || !inventoryId) return;
      setUploadingItemId(itemId);
      setSaveError(null);
      try {
        const updated = await uploadDishwareItemImage(restaurantId, Number(inventoryId), itemId, file);
        mergeItemPhotoFromServer(updated, itemId);
      } catch (e) {
        console.error("Failed to upload item image", e);
        setSaveError(getFriendlyInventoryError(e, "Не удалось загрузить фото"));
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
      } catch (e) {
        console.error("Failed to delete item image", e);
        setSaveError(getFriendlyInventoryError(e, "Не удалось удалить фото"));
      } finally {
        setUploadingItemId(null);
      }
    },
    [inventoryId, mergeItemPhotoFromServer, restaurantId],
  );

  const printFormButtons: EditorActionButton[] = [
    actionButton("Скачать бланк", Download, () => void handleDownloadPrintForm(), { isLoading: downloadingPrintForm }),
    actionButton("Распечатать", Printer, () => void handlePrintForm(), { isLoading: printingPrintForm }),
  ];
  const actionButtons: EditorActionButton[] = isCompleted
    ? [...printFormButtons, actionButton("Вернуть в черновик", Undo2, () => void handleReopen(), { isLoading: saving })]
    : [
        actionButton("Сохранить", Save, () => void handleSave(), { isLoading: saving }),
        ...printFormButtons,
        actionButton("Завершить", Check, () => void handleComplete(), { isLoading: saving }),
        actionButton("В корзину", Trash2, () => setDeleteOpen(true), { disabled: saving, className: "text-red-600" }),
      ];

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
        <Button variant="outline" onClick={() => navigate(dishwareListPath)}>
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
            {actionButtons.map(({ label, icon, onClick, isLoading, disabled, className }) => (
              <Button
                key={label}
                size="sm"
                variant={label === "Сохранить" ? "primary" : "outline"}
                className={["min-h-11", className].filter(Boolean).join(" ")}
                isLoading={isLoading}
                leftIcon={<Icon icon={icon} size="sm" decorative />}
                disabled={disabled || saving || editor.busy || uploadingItemId !== null}
                onClick={onClick}
              >
                {label}
              </Button>
            ))}
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
        <div className="text-muted text-xs" role="status" aria-live="polite">
          {editor.busy ? "Сохраняем…" : editor.dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
        </div>
        {editor.message ? <div className="text-muted text-sm">{editor.message}</div> : null}
        {editor.validationError && editor.dirty ? (
          <div className="text-sm text-red-600" role="alert">
            {editor.validationError}. Исправьте данные для сохранения.
          </div>
        ) : null}
        {editor.localError ? (
          <div className="text-sm text-red-600" role="alert">
            {editor.localError}
          </div>
        ) : null}
        {saveError || editor.saveError ? (
          <div className="text-sm text-red-600" role="alert">
            {saveError ?? editor.saveError}
          </div>
        ) : null}
      </Card>

      {editor.validationError ? (
        <Card className="text-muted text-sm">Итоги будут доступны после исправления данных.</Card>
      ) : (
        <DishwareInventorySummary summary={summary} />
      )}

      <DishwareInventoryItemsTable
        items={items}
        uploadingItemId={uploadingItemId}
        readOnly={isEditingLocked}
        photosLocked={editor.busy || uploadingItemId !== null}
        saving={saving}
        onAddItem={addItem}
        onChange={updateItem}
        onRemove={removeItem}
        onUploadImage={(itemId, file) => void handleUploadImage(itemId, file)}
        onDeleteImage={(itemId) => void handleDeleteImage(itemId)}
      />

      <Modal
        open={blocker.state === "blocked"}
        title="Выйти из инвентаризации?"
        description="Можно сохранить последние изменения или выйти без их сохранения. Изменения, уже сохранённые автоматически, останутся в документе."
        onClose={() => {
          if (!saving && !editor.busy && uploadingItemId === null) blocker.reset?.();
        }}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              disabled={saving || editor.busy || uploadingItemId !== null || Boolean(editor.recovery)}
              isLoading={saving}
              onClick={() => {
                setSaving(true);
                setSaveError(null);
                void saveDraft()
                  .then(() => {
                    leaving.current = true;
                    blocker.proceed?.();
                  })
                  .catch((e) => {
                    setSaveError(
                      getFriendlyInventoryError(e, e instanceof Error ? e.message : "Не удалось сохранить документ"),
                    );
                  })
                  .finally(() => setSaving(false));
              }}
            >
              Выйти и сохранить данные
            </Button>
            <Button
              variant="outline"
              disabled={saving || editor.busy || uploadingItemId !== null}
              onClick={() => {
                discard();
                leaving.current = true;
                blocker.proceed?.();
              }}
            >
              Выйти без сохранения
            </Button>
            <Button
              variant="ghost"
              disabled={saving || editor.busy || uploadingItemId !== null}
              onClick={() => blocker.reset?.()}
            >
              Остаться
            </Button>
          </div>
        }
      >
        {saveError ? (
          <p className="text-sm text-red-600" role="alert">
            {saveError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editor.recovery) && blocker.state !== "blocked"}
        title="Найдена локальная копия"
        description="Документ на сервере изменился после создания локальной копии. Восстановите свои правки для проверки или используйте документ с сервера."
        onClose={() => {}}
        footer={
          <div className="flex flex-col gap-2">
            <Button onClick={() => editor.resolveRecovery(true)}>Восстановить мои изменения</Button>
            <Button variant="outline" onClick={() => editor.resolveRecovery(false)}>
              Использовать данные с сервера
            </Button>
          </div>
        }
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
  const { inventoryId } = useParams();
  const { user } = useAuth();
  return (
    <InventoryAccessGuard>
      <AuthorizedDishwareInventoryEditorPage key={`${user?.id}:${user?.restaurantId}:${inventoryId}`} />
    </InventoryAccessGuard>
  );
}
