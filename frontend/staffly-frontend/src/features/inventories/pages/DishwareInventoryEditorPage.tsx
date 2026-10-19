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
import DishwareHistoryModal from "../components/DishwareHistoryModal";
import DishwareConflictModal from "../components/DishwareConflictModal";
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
  type DishwareInventoryDto,
} from "../api";
import { createEmptyDishwareInventoryItem, type DishwareInventoryEditableItem } from "../dishwareInventoryItems";
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoEditing, setPhotoEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
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
    saving || deleting || exitPending || photoEditing || uploadingClientId !== null,
  );
  const { draft, setDraft, initialize, discard, captureConflict, adoptPhoto, stagePhoto, removeStagedPhoto } = editor;
  const inventory = editor.server;
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
      (photoEditing ||
        editor.dirty ||
        editor.busy ||
        saving ||
        uploadingClientId !== null ||
        Boolean(editor.recovery) ||
        Boolean(editor.conflict)),
  );
  useEffect(() => {
    setExitPending(blocker.state === "blocked");
  }, [blocker.state]);

  useEffect(() => {
    if (!photoEditing) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [photoEditing]);

  const loadInventory = useCallback(async () => {
    if (!restaurantId || !inventoryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDishwareInventory(restaurantId, Number(inventoryId));
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
    return computeDishwareSummary(items, draft.includeSurplus);
  }, [items, draft.includeSurplus]);
  const isCompleted = inventory?.status === "COMPLETED";
  const isEditingLocked = isCompleted || saving || exitPending || Boolean(editor.recovery) || Boolean(editor.conflict);
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

  const applyLoadedInventory = useCallback(
    (data: DishwareInventoryDto) => {
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
        if (captureConflict(e)) {
          setReopenOpen(false);
          return;
        }
        setSaveError(getFriendlyInventoryError(e, e instanceof Error ? e.message : fallbackMessage));
      } finally {
        setSaving(false);
      }
    },
    [captureConflict, inventoryId, restaurantId],
  );

  const handleSave = useCallback(async () => {
    await runSaveAction(() => saveDraft(), "Failed to save inventory", "Не удалось сохранить инвентаризацию");
  }, [runSaveAction, saveDraft]);

  const handleComplete = useCallback(async () => {
    await runSaveAction(
      async (restaurantId, inventoryId) => {
        const saved = await saveDraft();
        const completed = await completeDishwareInventory(restaurantId, inventoryId, saved.version);
        applyLoadedInventory(completed);
      },
      "Failed to complete inventory",
      "Не удалось завершить инвентаризацию",
    );
  }, [applyLoadedInventory, runSaveAction, saveDraft]);

  const handleReopen = useCallback(async () => {
    await runSaveAction(
      async (restaurantId, inventoryId) => {
        const reopened = await reopenDishwareInventory(
          restaurantId,
          inventoryId,
          inventory!.version,
          reopenReason.trim(),
        );
        applyLoadedInventory(reopened);
        setReopenOpen(false);
        setReopenReason("");
      },
      "Failed to reopen inventory",
      "Не удалось вернуть документ в черновик",
    );
  }, [applyLoadedInventory, inventory, reopenReason, runSaveAction]);

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
      if (captureConflict(e)) return;
      setSaveError(getFriendlyInventoryError(e, "Не удалось скачать бланк"));
    } finally {
      setSaving(false);
      setDownloadingPrintForm(false);
    }
  }, [captureConflict, downloadingPrintForm, inventoryId, isCompleted, restaurantId, saveDraft, saving, title]);

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
      if (captureConflict(e)) return;
      setSaveError(getFriendlyInventoryError(e, "Не удалось подготовить бланк к печати"));
    } finally {
      setSaving(false);
      setPrintingPrintForm(false);
    }
  }, [captureConflict, inventoryId, isCompleted, printingPrintForm, restaurantId, saveDraft, saving]);

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
      setSaveError(getFriendlyInventoryError(e, "Не удалось переместить документ в корзину. Повторите попытку."));
    } finally {
      setDeleting(false);
    }
  }, [discard, dishwareListPath, inventoryId, navigate, restaurantId]);

  const handleUploadImage = useCallback(
    async (clientId: string, file: File, originalFile?: File) => {
      setSaveError(null);
      return stagePhoto(clientId, file, originalFile);
    },
    [stagePhoto],
  );

  const handleDeleteImage = useCallback(
    async (clientId: string) => {
      if (!restaurantId || !inventoryId) return;
      const item = items.find((row) => row.clientId === clientId);
      if (!item) return;
      if (!item.id || item.pendingPhoto || item.removePhoto) {
        removeStagedPhoto(clientId);
        return;
      }
      const itemId = item.id;
      setUploadingClientId(clientId);
      setSaveError(null);
      try {
        const updated = await deleteDishwareItemImage(restaurantId, Number(inventoryId), itemId, inventory!.version);
        adoptPhoto(updated, itemId);
      } catch (e) {
        console.error("Failed to delete item image", e);
        if (captureConflict(e)) return;
        setSaveError(getFriendlyInventoryError(e, "Не удалось удалить фото"));
      } finally {
        setUploadingClientId(null);
      }
    },
    [adoptPhoto, captureConflict, inventory, inventoryId, items, restaurantId, removeStagedPhoto],
  );

  const printFormButtons: EditorActionButton[] = [
    actionButton("Скачать бланк", Download, () => void handleDownloadPrintForm(), { isLoading: downloadingPrintForm }),
    actionButton("Распечатать", Printer, () => void handlePrintForm(), { isLoading: printingPrintForm }),
  ];
  const actionGroups: EditorActionButton[][] = isCompleted
    ? [
        [
          actionButton(
            "Вернуть в черновик",
            Undo2,
            () => {
              setSaveError(null);
              setReopenOpen(true);
            },
            { isLoading: saving },
          ),
        ],
        printFormButtons,
      ]
    : [
        [
          actionButton("Сохранить", Save, () => void handleSave(), { isLoading: saving }),
          actionButton("Завершить", Check, () => void handleComplete(), { isLoading: saving }),
        ],
        printFormButtons,
        [
          actionButton(
            "В корзину",
            Trash2,
            () => {
              setSaveError(null);
              setDeleteOpen(true);
            },
            { disabled: saving, className: "text-red-600" },
          ),
        ],
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
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_170px_auto_auto] xl:items-end">
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
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="shrink-0">
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
            <Button
              size="sm"
              variant="outline"
              className="min-w-0 px-2 [&>span]:whitespace-normal"
              onClick={() => setHistoryOpen(true)}
            >
              История изменений
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
            {actionGroups.map((group, index) => (
              <div key={index} className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
                {group.map(({ label, icon, onClick, isLoading, disabled, className }) => (
                  <Button
                    key={label}
                    size="sm"
                    variant={label === "Сохранить" ? "primary" : "outline"}
                    className={[
                      "min-h-11 min-w-0 max-sm:gap-1 max-sm:px-2 [&>span:last-child]:whitespace-normal",
                      group.length === 1 && "col-span-2",
                      className,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    isLoading={isLoading}
                    leftIcon={<Icon icon={icon} size="sm" decorative />}
                    disabled={
                      disabled || saving || editor.busy || uploadingClientId !== null || Boolean(editor.conflict)
                    }
                    onClick={onClick}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.includeSurplus ?? false}
              disabled={isEditingLocked}
              onChange={(event) => setDraft((previous) => ({ ...previous, includeSurplus: event.target.checked }))}
            />
            Учёт излишков
          </label>
          <span className="text-muted text-xs">
            {draft.includeSurplus ? "Излишки уменьшают сумму потерь" : "Излишки не компенсируют недостачу"}
          </span>
          <div className="text-muted flex flex-wrap items-center gap-2 text-xs">
            <span>Последнее изменение: {new Date(inventory.updatedAt).toLocaleString("ru-RU")}</span>
          </div>
        </div>

        {inventory.hasCorrections && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Документ открывали для исправления после завершения. Причины и изменения доступны в истории.
          </p>
        )}

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
          <div className="text-muted text-xs">
            Источник: {inventory.sourceInventoryTitle}. Остатки скопированы при создании и не меняются автоматически при
            исправлении источника.
          </div>
        ) : null}

        {isCompleted ? (
          <div className="text-muted rounded-2xl bg-[color:var(--staffly-control)] px-3 py-2 text-sm">
            Документ зафиксирован. Исправления возможны после возврата в черновик с указанием причины. Смена статусов и
            правки сохраняются в истории.
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
        {!editor.conflict && (saveError || editor.saveError) ? (
          <div className="text-sm text-red-600" role="alert">
            {saveError ?? editor.saveError}
          </div>
        ) : null}
      </Card>

      {editor.validationError ? (
        <Card className="text-muted text-sm">Итоги будут доступны после исправления данных.</Card>
      ) : (
        <DishwareInventorySummary summary={summary} includeSurplus={draft.includeSurplus ?? false} />
      )}

      <DishwareInventoryItemsTable
        items={items}
        includeSurplus={draft.includeSurplus ?? false}
        uploadingClientId={uploadingClientId ?? editor.preparingPhoto}
        readOnly={isEditingLocked}
        photosLocked={editor.busy || uploadingClientId !== null}
        saving={saving}
        onAddItem={addItem}
        onChange={updateItem}
        onRemove={removeItem}
        onPhotoEditingChange={setPhotoEditing}
        onUploadImage={handleUploadImage}
        onDeleteImage={(itemId) => void handleDeleteImage(itemId)}
      />

      <Modal
        open={blocker.state === "blocked" && !editor.conflict}
        title="Выйти из инвентаризации?"
        description="Можно сохранить последние изменения или выйти без их сохранения. Изменения, уже сохранённые автоматически, останутся в документе."
        onClose={() => {
          if (!saving && !editor.busy && uploadingClientId === null) blocker.reset?.();
        }}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              disabled={saving || editor.busy || uploadingClientId !== null || Boolean(editor.recovery)}
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
              disabled={saving || editor.busy || uploadingClientId !== null}
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
              disabled={saving || editor.busy || uploadingClientId !== null}
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
        open={Boolean(editor.recovery) && !editor.conflict && blocker.state !== "blocked"}
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

      {historyOpen && restaurantId && (
        <DishwareHistoryModal
          restaurantId={restaurantId}
          inventoryId={Number(inventoryId)}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <Modal
        open={reopenOpen}
        title="Исправить завершённую инвентаризацию?"
        description="Возврат в черновик, причина и все последующие правки будут видны в истории. Уже созданные на основе этого документа инвентаризации сохранят свои исходные остатки."
        onClose={() => {
          if (!saving) setReopenOpen(false);
        }}
        footer={
          <div className="flex gap-2">
            <Button disabled={saving || !reopenReason.trim()} isLoading={saving} onClick={() => void handleReopen()}>
              Открыть для исправления
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => setReopenOpen(false)}>
              Отмена
            </Button>
          </div>
        }
      >
        <Textarea
          label="Причина исправления"
          value={reopenReason}
          maxLength={1000}
          disabled={saving}
          onChange={(event) => setReopenReason(event.target.value)}
          placeholder="Например: обнаружена ошибка при подсчёте бокалов"
        />
        {saveError && (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        )}
      </Modal>

      <DishwareConflictModal
        conflict={editor.conflict}
        busy={editor.busy}
        pending={editor.hasPendingSave}
        error={editor.saveError}
        onResolve={(mode) => {
          setSaveError(null);
          void editor.resolveConflict(mode);
        }}
        onCancel={editor.cancelConflict}
        onAcceptCurrent={editor.acceptCurrent}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Переместить в корзину"
        description={
          <div className="space-y-2">
            <p>Документ исчезнет из активного списка. В корзине его можно восстановить или удалить навсегда.</p>
            {saveError ? (
              <p role="alert" className="text-red-600">
                {saveError}
              </p>
            ) : null}
          </div>
        }
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
