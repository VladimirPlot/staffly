import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, Check, Download, History, Image as ImageIcon, Lock, Pencil, Trash2, Unlock, X } from "lucide-react";

import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { compressImageFile } from "../../../shared/lib/compressImageFile";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import {
  createChecklist,
  deleteChecklist,
  deleteChecklistItemCompletionPhoto,
  deleteChecklistItemExamplePhoto,
  getChecklistHistory,
  listChecklists,
  listChecklistHistory,
  reserveChecklistItem,
  unreserveChecklistItem,
  completeChecklistItem,
  undoChecklistItem,
  resetChecklist,
  updateChecklist,
  uploadChecklistItemCompletionPhoto,
  uploadChecklistItemExamplePhoto,
  type ChecklistDto,
  type ChecklistHistoryDetailDto,
  type ChecklistHistorySummaryDto,
  type ChecklistItemDto,
  type ChecklistKind,
} from "../api";
import ChecklistDialog, { type ChecklistDialogInitial, type ChecklistDialogSubmitPayload } from "./ChecklistDialog";
import { toJpeg } from "html-to-image";

export type RestaurantChecklistsProps = {
  restaurantId: number;
  canManage: boolean;
};

function sanitizeFileName(name: string): string {
  const safe = name?.trim() || "checklist";
  return safe.replace(/[\\/:*?"<>|]+/g, "_");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resetReasonLabel(reason?: string | null): string {
  if (reason === "AUTO") return "Авто";
  if (reason === "MANUAL") return "Вручную";
  return "—";
}

function hasPhoto(url?: string | null): boolean {
  return Boolean(url && url.trim());
}

const RestaurantChecklists = ({ restaurantId, canManage }: RestaurantChecklistsProps) => {
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<ChecklistDialogInitial | undefined>(undefined);
  const [editing, setEditing] = useState<ChecklistDto | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ChecklistDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [itemActionLoading, setItemActionLoading] = useState<Set<string>>(new Set());
  const [itemActionError, setItemActionError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadMenuFor, setDownloadMenuFor] = useState<number | null>(null);
  const [mediaExpanded, setMediaExpanded] = useState<Set<string>>(new Set());
  const [photoUploading, setPhotoUploading] = useState<Set<string>>(new Set());
  const [historyTarget, setHistoryTarget] = useState<ChecklistDto | null>(null);
  const [historySummaries, setHistorySummaries] = useState<ChecklistHistorySummaryDto[]>([]);
  const [historyDetail, setHistoryDetail] = useState<ChecklistHistoryDetailDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const checklistRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const downloadMenuRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const errorTimeoutRef = useRef<number | null>(null);

  const activeTab = searchParams.get("tab") === "scripts" ? "scripts" : "checklists";
  const activeKind: ChecklistKind = activeTab === "scripts" ? "INFO" : "TRACKABLE";
  const dialogKind = editing?.kind ?? activeKind;
  const createDialogTitle = editing
    ? dialogKind === "INFO"
      ? "Редактирование скрипта"
      : "Редактирование чек-листа"
    : activeTab === "scripts"
      ? "Новый скрипт"
      : "Новый чек-лист";
  const emptyStateLabel = activeTab === "scripts" ? "Скрипты пока не добавлены." : "Чек-листы пока не добавлены.";

  const loadPositions = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await listPositions(restaurantId, { includeInactive: true });
      setPositions(data);
    } catch (e) {
      console.error("Failed to load positions", e);
    }
  }, [restaurantId]);

  const loadChecklists = useCallback(
    async (signal?: AbortSignal) => {
      if (!restaurantId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await listChecklists(
          restaurantId,
          {
            positionId: canManage && positionFilter ? positionFilter : undefined,
            kind: activeKind,
            q: debouncedQuery,
          },
          signal
        );
        setChecklists(data);
        setExpanded(new Set());
        setMediaExpanded(new Set());
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") {
          return;
        }
        console.error("Failed to load checklists", e);
        setError("Не удалось загрузить список");
        setChecklists([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [restaurantId, canManage, positionFilter, activeKind, debouncedQuery]
  );

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    void loadChecklists(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadChecklists]);

  const openCreateDialog = useCallback(() => {
    setEditing(null);
    setDialogError(null);

    setDialogInitial({
      kind: activeKind,
      name: "",
      content: "",
      positionIds: [],
      periodicity: activeKind === "TRACKABLE" ? "DAILY" : undefined,
      items: [{ text: "", completionPhotoRequired: false }],
    });

    setDialogOpen(true);
  }, [activeKind]);

  const openEditDialog = useCallback((checklist: ChecklistDto) => {
    setEditing(checklist);
    setDialogError(null);
    setDialogInitial({
      kind: checklist.kind,
      name: checklist.name,
      content: checklist.content ?? "",
      positionIds: checklist.positions.map((p) => p.id),
      periodicity: checklist.periodicity,
      resetTime: checklist.resetTime ?? undefined,
      resetDayOfWeek: checklist.resetDayOfWeek ?? undefined,
      resetDayOfMonth: checklist.resetDayOfMonth ?? undefined,
      items: checklist.items.map((item) => ({
        id: item.id,
        text: item.text,
        completionPhotoRequired: item.completionPhotoRequired,
        examplePhotoUrl: item.examplePhotoUrl,
      })),
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSubmitDialog = useCallback(
    async (payload: ChecklistDialogSubmitPayload) => {
      if (!restaurantId) return;
      setDialogSubmitting(true);
      setDialogError(null);

      let savedAfterUpsert: ChecklistDto | null = null;
      try {
        const { exampleFiles = [], examplePhotoDeletes = [], ...checklistPayload } = payload;
        let saved: ChecklistDto;
        if (editing) {
          saved = await updateChecklist(restaurantId, editing.id, checklistPayload);
        } else {
          saved = await createChecklist(restaurantId, checklistPayload);
        }
        savedAfterUpsert = saved;

        for (const itemId of examplePhotoDeletes) {
          saved = await deleteChecklistItemExamplePhoto(restaurantId, saved.id, itemId);
          savedAfterUpsert = saved;
        }

        for (const entry of exampleFiles) {
          const targetItem = saved.items[entry.index];
          if (!targetItem) continue;
          const compressed = await compressImageFile(entry.file);
          saved = await uploadChecklistItemExamplePhoto(restaurantId, saved.id, targetItem.id, compressed);
          savedAfterUpsert = saved;
        }

        setDialogOpen(false);
        setEditing(null);
        await loadChecklists();
      } catch (e: any) {
        console.error("Failed to save checklist", e);
        if (savedAfterUpsert) {
          setEditing(savedAfterUpsert);
          await loadChecklists();
          setDialogError(e?.friendlyMessage || "Чек-лист сохранён, но не удалось загрузить часть фото. Повторите сохранение.");
        } else {
          setDialogError(e?.friendlyMessage || "Не удалось сохранить чек-лист");
        }
      } finally {
        setDialogSubmitting(false);
      }
    },
    [restaurantId, editing, loadChecklists]
  );

  const toggleExpanded = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openDeleteDialog = useCallback((checklist: ChecklistDto) => {
    setDeleteTarget(checklist);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChecklist(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadChecklists();
    } catch (e) {
      console.error("Failed to delete checklist", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadChecklists]);

  const resetFilter = useCallback(() => {
    setPositionFilter(null);
    setSearchTerm("");
  }, []);

  const positionNames = useMemo(() => {
    const map = new Map<number, string>();
    positions.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [positions]);

  const updateChecklistInState = useCallback((updated: ChecklistDto) => {
    setChecklists((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const reportItemActionError = useCallback((message: string | null) => {
    setItemActionError(message);
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    if (message) {
      errorTimeoutRef.current = window.setTimeout(() => {
        setItemActionError(null);
        errorTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

  const toggleItemAction = useCallback((key: string, loading: boolean) => {
    setItemActionLoading((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleItemAction = useCallback(
    async (key: string, action: () => Promise<ChecklistDto>) => {
      if (itemActionLoading.has(key)) return;
      reportItemActionError(null);
      toggleItemAction(key, true);
      try {
        const updated = await action();
        updateChecklistInState(updated);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 409 || status === 403) {
          reportItemActionError("Пункт забронирован другим сотрудником");
        } else {
          console.error("Failed to update checklist item", e);
          reportItemActionError(e?.friendlyMessage || "Не удалось обновить пункт");
        }
      } finally {
        toggleItemAction(key, false);
      }
    },
    [itemActionLoading, reportItemActionError, toggleItemAction, updateChecklistInState]
  );

  const toggleMediaExpanded = useCallback((checklistId: number, itemId: number) => {
    const key = `${checklistId}-${itemId}`;
    setMediaExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const togglePhotoUploading = useCallback((key: string, loading: boolean) => {
    setPhotoUploading((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleCompletionPhotoUpload = useCallback(
    async (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => {
      const key = `${checklist.id}-${item.id}-completion-photo`;
      if (photoUploading.has(key)) return;
      reportItemActionError(null);
      togglePhotoUploading(key, true);
      try {
        const compressed = await compressImageFile(file);
        const updated = await uploadChecklistItemCompletionPhoto(restaurantId, checklist.id, item.id, compressed);
        updateChecklistInState(updated);
      } catch (e: any) {
        console.error("Failed to upload checklist item photo", e);
        reportItemActionError(e?.friendlyMessage || "Не удалось загрузить фото");
      } finally {
        togglePhotoUploading(key, false);
      }
    },
    [photoUploading, reportItemActionError, restaurantId, togglePhotoUploading, updateChecklistInState]
  );

  const handleCompletionPhotoDelete = useCallback(
    async (checklist: ChecklistDto, item: ChecklistItemDto) => {
      const key = `${checklist.id}-${item.id}-completion-photo`;
      if (photoUploading.has(key)) return;
      reportItemActionError(null);
      togglePhotoUploading(key, true);
      try {
        const updated = await deleteChecklistItemCompletionPhoto(restaurantId, checklist.id, item.id);
        updateChecklistInState(updated);
      } catch (e: any) {
        console.error("Failed to delete checklist item photo", e);
        reportItemActionError(e?.friendlyMessage || "Не удалось удалить фото");
      } finally {
        togglePhotoUploading(key, false);
      }
    },
    [photoUploading, reportItemActionError, restaurantId, togglePhotoUploading, updateChecklistInState]
  );

  const handleReset = useCallback(
    async (checklist: ChecklistDto) => {
      setResetting(checklist.id);
      try {
        await resetChecklist(restaurantId, checklist.id);
        await loadChecklists();
      } catch (e) {
        console.error("Failed to reset checklist", e);
      } finally {
        setResetting(null);
      }
    },
    [restaurantId, loadChecklists]
  );

  const loadHistoryDetail = useCallback(
    async (historyId: number) => {
      setHistoryDetailLoading(historyId);
      setHistoryError(null);
      try {
        const detail = await getChecklistHistory(restaurantId, historyId);
        setHistoryDetail(detail);
      } catch (e: any) {
        console.error("Failed to load checklist history detail", e);
        setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        setHistoryDetailLoading(null);
      }
    },
    [restaurantId]
  );

  const openHistoryModal = useCallback(
    async (checklist: ChecklistDto) => {
      setHistoryTarget(checklist);
      setHistorySummaries([]);
      setHistoryDetail(null);
      setHistoryError(null);
      setHistoryLoading(true);
      try {
        const summaries = await listChecklistHistory(restaurantId, checklist.id);
        setHistorySummaries(summaries);
        if (summaries[0]) {
          await loadHistoryDetail(summaries[0].id);
        }
      } catch (e: any) {
        console.error("Failed to load checklist history", e);
        setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        setHistoryLoading(false);
      }
    },
    [loadHistoryDetail, restaurantId]
  );

  const closeHistoryModal = useCallback(() => {
    if (historyLoading || historyDetailLoading !== null) return;
    setHistoryTarget(null);
    setHistorySummaries([]);
    setHistoryDetail(null);
    setHistoryError(null);
  }, [historyDetailLoading, historyLoading]);

  const handleDownloadJpg = useCallback(
    async (checklist: ChecklistDto) => {
      const node = checklistRefs.current.get(checklist.id);
      if (!node) return;
      setDownloadMenuFor(null);
      setDownloading(checklist.id);
      try {
        const dataUrl = await toJpeg(node, { quality: 0.95, pixelRatio: 2, backgroundColor: "#ffffff" });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${sanitizeFileName(checklist.name)}.jpg`;
        link.click();
      } catch (e) {
        console.error("Failed to download checklist", e);
      } finally {
        setDownloading(null);
      }
    },
    []
  );

  const setChecklistRef = useCallback((id: number, node: HTMLDivElement | null) => {
    checklistRefs.current.set(id, node);
  }, []);

  const setDownloadMenuRef = useCallback((id: number, node: HTMLDivElement | null) => {
    downloadMenuRefs.current.set(id, node);
  }, []);

  const toggleDownloadMenu = useCallback((checklistId: number) => {
    setDownloadMenuFor((current) => (current === checklistId ? null : checklistId));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadMenuFor === null) return;
      const menuNode = downloadMenuRefs.current.get(downloadMenuFor);
      if (menuNode && !menuNode.contains(event.target as Node)) {
        setDownloadMenuFor(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDownloadMenuFor(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [downloadMenuFor]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleOpenDialog() {
      openCreateDialog();
    }

    window.addEventListener("open-checklist-dialog", handleOpenDialog);
    return () => {
      window.removeEventListener("open-checklist-dialog", handleOpenDialog);
    };
  }, [openCreateDialog]);

  const visibleChecklists = useMemo(() => {
    const collator = new Intl.Collator("ru", { sensitivity: "base" });
    return [...checklists].sort((a, b) => {
      if (activeKind === "TRACKABLE") {
        const completedDiff = Number(a.completed) - Number(b.completed);
        if (completedDiff !== 0) {
          return completedDiff;
        }
      }
      return collator.compare(a.name ?? "", b.name ?? "");
    });
  }, [checklists, activeKind]);

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-4">

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Input
            label="Поиск"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Поиск по названию…"
            className="md:max-w-sm"
          />
          {canManage && (
            <>
              <DropdownSelect
                aria-label="Фильтр по должности"
                className="h-10 rounded-2xl px-3 text-sm shadow-[var(--staffly-shadow)] transition hover:bg-app focus:outline-none focus:ring-2 ring-default"
                value={positionFilter ?? ""}
                onChange={(event) => setPositionFilter(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Все должности</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </DropdownSelect>
              <button
                type="button"
                onClick={resetFilter}
                className={`flex items-center gap-1 rounded-full border border-transparent p-2 text-sm transition ${
                  positionFilter == null && !searchTerm ? "text-muted/60" : "text-muted hover:text-default"
                }`}
                aria-label="Сбросить фильтры"
                disabled={positionFilter == null && !searchTerm}
              >
                <Icon icon={X} size="sm" decorative />
                <span>Сбросить</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && (
          <Card className="text-sm text-muted">Загрузка чек-листов…</Card>
        )}
        {error && <Card className="text-sm text-red-600">{error}</Card>}
        {itemActionError && <Card className="text-sm text-red-600">{itemActionError}</Card>}
        {!loading && !error && visibleChecklists.length === 0 && (
          <Card className="text-sm text-muted">{emptyStateLabel}</Card>
        )}
        {!loading && !error &&
          visibleChecklists.map((checklist) => {
            const isExpanded = expanded.has(checklist.id);
            const assignedNames = checklist.positions.length
              ? checklist.positions.map((p) => p.name || positionNames.get(p.id) || `Должность #${p.id}`).join(", ")
              : "—";
            const isTrackable = checklist.kind === "TRACKABLE";
            const isResetting = resetting === checklist.id;
            const isDownloading = downloading === checklist.id;
            return (
              <div
                key={checklist.id}
                className="rounded-2xl border border-subtle bg-app/70 p-4"
                ref={(node) => setChecklistRef(checklist.id, node)}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {isTrackable && (
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${
                            checklist.completed ? "bg-emerald-500" : "bg-amber-400"
                          }`}
                          aria-hidden
                        />
                      )}
                      <div className="text-base font-semibold text-strong [overflow-wrap:anywhere]">{checklist.name}</div>
                    </div>
                    {isTrackable && checklist.periodLabel && (
                      <div className="text-sm text-default">{checklist.periodLabel}</div>
                    )}
                    <div className="mt-1 text-xs uppercase tracking-wide text-muted [overflow-wrap:anywhere]">{assignedNames}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => toggleExpanded(checklist.id)} className="text-sm">
                      {isExpanded ? "Свернуть" : "Открыть"}
                    </Button>
                    {canManage && (
                      <div
                        className="relative"
                        ref={(node) => setDownloadMenuRef(checklist.id, node)}
                      >
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleDownloadMenu(checklist.id)}
                          disabled={isDownloading}
                          className="text-default"
                          aria-haspopup="menu"
                          aria-expanded={downloadMenuFor === checklist.id}
                          aria-controls={downloadMenuFor === checklist.id ? `download-menu-${checklist.id}` : undefined}
                        >
                          <Icon icon={Download} />
                          <span className="sr-only">Скачать</span>
                        </Button>
                        {downloadMenuFor === checklist.id && (
                          <div
                            id={`download-menu-${checklist.id}`}
                            role="menu"
                            className="absolute right-0 z-10 mt-2 w-36 rounded-2xl border border-subtle bg-surface p-1 shadow-[var(--staffly-shadow)]"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-sm text-default"
                              onClick={() => handleDownloadJpg(checklist)}
                              disabled={isDownloading}
                              role="menuitem"
                            >
                              Скачать .jpg
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditDialog(checklist)}
                        className="text-default"
                        aria-label="Редактировать"
                      >
                        <Icon icon={Pencil} />
                      </Button>
                    )}
                    {canManage && isTrackable && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openHistoryModal(checklist)}
                        className="text-default"
                        aria-label="История"
                      >
                        <Icon icon={History} />
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openDeleteDialog(checklist)}
                        className="text-default"
                        aria-label="Удалить"
                      >
                        <Icon icon={Trash2} />
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 rounded-2xl border border-subtle bg-surface text-sm text-default">
                    {isTrackable ? (
                      <div>
                        {checklist.items.map((item) => {
                          const reserveKey = `${checklist.id}-${item.id}-reserve`;
                          const unreserveKey = `${checklist.id}-${item.id}-unreserve`;
                          const completeKey = `${checklist.id}-${item.id}-complete`;
                          const undoKey = `${checklist.id}-${item.id}-undo`;
                          const reserveLoading = itemActionLoading.has(reserveKey);
                          const unreserveLoading = itemActionLoading.has(unreserveKey);
                          const completeLoading = itemActionLoading.has(completeKey);
                          const undoLoading = itemActionLoading.has(undoKey);
                          const isBusy = reserveLoading || unreserveLoading || completeLoading || undoLoading;
                          const mediaKey = `${checklist.id}-${item.id}`;
                          const completionPhotoKey = `${checklist.id}-${item.id}-completion-photo`;
                          const isMediaExpanded = mediaExpanded.has(mediaKey);
                          const isPhotoUploading = photoUploading.has(completionPhotoKey);
                          const hasExamplePhoto = hasPhoto(item.examplePhotoUrl);
                          const hasCompletionPhoto = hasPhoto(item.completionPhotoUrl);
                          const missingRequiredPhoto = item.completionPhotoRequired && !hasCompletionPhoto;
                          const statusLabel = item.done
                            ? `Выполнил: ${item.doneBy?.name ?? "Без автора"}`
                            : item.reservedBy
                              ? `В работе: ${item.reservedBy?.name ?? "Занято"}`
                              : "—";
                          return (
                            <div key={item.id} className="border-b border-subtle px-3 py-3 last:border-b-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <ContentText
                                    className={`[overflow-wrap:anywhere] ${item.done ? "text-muted line-through" : "text-default"}`}
                                  >
                                    {item.text}
                                  </ContentText>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                                    <span>{statusLabel}</span>
                                    {item.completionPhotoRequired && (
                                      <span className={missingRequiredPhoto ? "text-red-600" : "text-emerald-700"}>
                                        Фото обязательно
                                      </span>
                                    )}
                                    {hasExamplePhoto && (
                                      <span className="inline-flex items-center gap-1">
                                        <Icon icon={ImageIcon} size="xs" decorative />
                                        Пример
                                      </span>
                                    )}
                                    {hasCompletionPhoto && (
                                      <span className="inline-flex items-center gap-1">
                                        <Icon icon={Camera} size="xs" decorative />
                                        Выполнение
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9"
                                    aria-label={isMediaExpanded ? "Свернуть фото" : "Открыть фото"}
                                    onClick={() => toggleMediaExpanded(checklist.id, item.id)}
                                  >
                                    <Icon icon={isMediaExpanded ? X : Camera} />
                                  </Button>
                                  {!item.done && !item.reservedBy && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-9 w-9"
                                      aria-label="Взять в работу"
                                      disabled={isBusy}
                                      isLoading={reserveLoading}
                                      onClick={() =>
                                        handleItemAction(reserveKey, () =>
                                          reserveChecklistItem(restaurantId, checklist.id, item.id)
                                        )
                                      }
                                    >
                                      {!reserveLoading && <Icon icon={Lock} />}
                                    </Button>
                                  )}
                                  {!item.done && item.reservedBy && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9"
                                      aria-label="Снять бронь"
                                      disabled={isBusy}
                                      isLoading={unreserveLoading}
                                      onClick={() =>
                                        handleItemAction(unreserveKey, () =>
                                          unreserveChecklistItem(restaurantId, checklist.id, item.id)
                                        )
                                      }
                                    >
                                      {!unreserveLoading && <Icon icon={Unlock} />}
                                    </Button>
                                  )}
                                  {!item.done && (
                                    <Button
                                      size="icon"
                                      className="h-9 w-9"
                                      aria-label="Отметить как готово"
                                      disabled={isBusy || missingRequiredPhoto}
                                      isLoading={completeLoading}
                                      onClick={() =>
                                        handleItemAction(completeKey, () =>
                                          completeChecklistItem(restaurantId, checklist.id, item.id)
                                        )
                                      }
                                    >
                                      {!completeLoading && <Icon icon={Check} />}
                                    </Button>
                                  )}
                                  {item.done && canManage && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-9 w-9"
                                      aria-label="Снять выполнение"
                                      disabled={isBusy}
                                      isLoading={undoLoading}
                                      onClick={() =>
                                        handleItemAction(undoKey, () =>
                                          undoChecklistItem(restaurantId, checklist.id, item.id)
                                        )
                                      }
                                    >
                                      {!undoLoading && <Icon icon={X} />}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {missingRequiredPhoto && !item.done && (
                                <div className="mt-2 text-xs text-red-600">Перед закрытием нужно прикрепить фото выполнения.</div>
                              )}
                              {isMediaExpanded && (
                                <div className="mt-3 grid gap-3 rounded-2xl border border-subtle bg-app/70 p-3 md:grid-cols-2">
                                  <div>
                                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Пример</div>
                                    {hasExamplePhoto ? (
                                      <a href={item.examplePhotoUrl!} target="_blank" rel="noreferrer" className="block">
                                        <img
                                          src={item.examplePhotoUrl!}
                                          alt={`Пример: ${item.text}`}
                                          className="aspect-video w-full rounded-2xl object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-subtle text-sm text-muted">
                                        Пример не добавлен
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Фото выполнения</div>
                                    {hasCompletionPhoto ? (
                                      <div className="space-y-2">
                                        <a href={item.completionPhotoUrl!} target="_blank" rel="noreferrer" className="block">
                                          <img
                                            src={item.completionPhotoUrl!}
                                            alt={`Фото выполнения: ${item.text}`}
                                            className="aspect-video w-full rounded-2xl object-cover"
                                          />
                                        </a>
                                        {item.completionPhotoUploadedBy && (
                                          <div className="text-xs text-muted">
                                            {item.completionPhotoUploadedBy.name || "Сотрудник"} ·{" "}
                                            {formatDateTime(item.completionPhotoUploadedAt)}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-subtle text-sm text-muted">
                                        Фото еще не прикреплено
                                      </div>
                                    )}
                                    {!item.done && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-subtle bg-[var(--staffly-control)] px-3 text-sm font-medium text-default shadow-sm transition hover:bg-[var(--staffly-control-hover)]">
                                          <Icon icon={Camera} size="sm" decorative />
                                          <span>{hasCompletionPhoto ? "Заменить" : "Прикрепить"}</span>
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            disabled={isPhotoUploading}
                                            onChange={(event) => {
                                              const file = event.target.files?.[0];
                                              if (file) {
                                                void handleCompletionPhotoUpload(checklist, item, file);
                                              }
                                              event.target.value = "";
                                            }}
                                          />
                                        </label>
                                        {hasCompletionPhoto && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleCompletionPhotoDelete(checklist, item)}
                                            disabled={isPhotoUploading}
                                            className="text-sm"
                                          >
                                            Удалить фото
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                    {isPhotoUploading && <div className="mt-2 text-xs text-muted">Загружаем фото...</div>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex flex-wrap gap-2 px-3 py-3">
                          {canManage && (
                            <Button
                              variant="outline"
                              onClick={() => handleReset(checklist)}
                              disabled={isResetting}
                              className="text-sm"
                            >
                              {isResetting ? "Сбрасываем…" : "Сбросить"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <ContentText className="p-4 [overflow-wrap:anywhere]">{checklist.content ?? ""}</ContentText>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <ChecklistDialog
        open={dialogOpen}
        title={createDialogTitle}
        positions={positions}
        initialData={dialogInitial}
        submitting={dialogSubmitting}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSubmitDialog}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Удалить чек-лист «${deleteTarget.name}»?` : ""}
        description="Это действие нельзя будет отменить"
        confirming={deleting}
        confirmText="Удалить"
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />

      <Modal
        open={Boolean(historyTarget)}
        title={historyTarget ? `История: ${historyTarget.name}` : "История"}
        onClose={closeHistoryModal}
        className="max-w-5xl"
        footer={
          <Button variant="outline" onClick={closeHistoryModal} disabled={historyLoading || historyDetailLoading !== null}>
            Закрыть
          </Button>
        }
      >
        <div className="space-y-4">
          {historyError && <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{historyError}</div>}
          {historyLoading && <div className="text-sm text-muted">Загрузка истории…</div>}
          {!historyLoading && historySummaries.length === 0 && (
            <div className="rounded-2xl border border-subtle p-4 text-sm text-muted">История пока не записана.</div>
          )}
          {historySummaries.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                {historySummaries.map((summary) => {
                  const selected = historyDetail?.id === summary.id;
                  return (
                    <button
                      key={summary.id}
                      type="button"
                      onClick={() => void loadHistoryDetail(summary.id)}
                      className={`w-full rounded-2xl border p-3 text-left text-sm transition ${
                        selected
                          ? "border-[var(--staffly-text-strong)] bg-app text-default"
                          : "border-subtle bg-surface text-default hover:bg-app"
                      }`}
                    >
                      <div className="font-medium">{formatDateTime(summary.resetAt)}</div>
                      <div className="mt-1 text-xs text-muted">
                        {resetReasonLabel(summary.resetReason)} · {summary.completedItems}/{summary.totalItems}
                      </div>
                      {historyDetailLoading === summary.id && <div className="mt-1 text-xs text-muted">Открываем…</div>}
                    </button>
                  );
                })}
              </div>

              <div className="min-w-0 rounded-2xl border border-subtle p-3">
                {!historyDetail && !historyDetailLoading && (
                  <div className="text-sm text-muted">Выберите запись истории.</div>
                )}
                {historyDetail && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-strong">
                        {formatDateTime(historyDetail.resetAt)} · {resetReasonLabel(historyDetail.resetReason)}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        Выполнено {historyDetail.completedItems}/{historyDetail.totalItems}
                        {historyDetail.positionsSnapshot ? ` · ${historyDetail.positionsSnapshot}` : ""}
                      </div>
                      {historyDetail.startedAt && (
                        <div className="mt-1 text-xs text-muted">Период с {formatDateTime(historyDetail.startedAt)}</div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {historyDetail.items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-subtle bg-app/60 p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <ContentText className="min-w-0 text-sm text-default [overflow-wrap:anywhere]">
                              {item.itemOrder}. {item.text}
                            </ContentText>
                            <div className={`text-xs ${item.done ? "text-emerald-700" : "text-muted"}`}>
                              {item.done ? "Выполнено" : "Не выполнено"}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted">
                            {item.done
                              ? `Исполнитель: ${item.doneBy?.name || item.doneByName || "—"}`
                              : item.reservedBy?.name || item.reservedByName
                                ? `Было в работе: ${item.reservedBy?.name || item.reservedByName}`
                                : "Исполнитель: —"}
                            {item.doneAt ? ` · ${formatDateTime(item.doneAt)}` : ""}
                          </div>
                          {item.completionPhotoUrl && (
                            <a href={item.completionPhotoUrl} target="_blank" rel="noreferrer" className="mt-3 block">
                              <img
                                src={item.completionPhotoUrl}
                                alt={`История выполнения: ${item.text}`}
                                className="max-h-72 w-full rounded-2xl object-cover"
                              />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default RestaurantChecklists;
