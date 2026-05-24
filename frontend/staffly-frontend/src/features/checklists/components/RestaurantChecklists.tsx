import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Download, Lock, Pencil, Trash2, Unlock, X } from "lucide-react";

import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import {
  createChecklist,
  deleteChecklist,
  listChecklists,
  reserveChecklistItem,
  unreserveChecklistItem,
  completeChecklistItem,
  undoChecklistItem,
  resetChecklist,
  updateChecklist,
  type ChecklistDto,
  type ChecklistRequest,
  type ChecklistKind,
} from "../api";
import ChecklistDialog, { type ChecklistDialogInitial } from "./ChecklistDialog";
import { toJpeg } from "html-to-image";

export type RestaurantChecklistsProps = {
  restaurantId: number;
  canManage: boolean;
};

function sanitizeFileName(name: string): string {
  const safe = name?.trim() || "checklist";
  return safe.replace(/[\\/:*?"<>|]+/g, "_");
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
      items: [""],
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
      items: checklist.items.map((item) => item.text),
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
    async (payload: ChecklistRequest) => {
      if (!restaurantId) return;
      setDialogSubmitting(true);
      setDialogError(null);

      try {
        if (editing) {
          await updateChecklist(restaurantId, editing.id, payload);
        } else {
          await createChecklist(restaurantId, payload);
        }

        setDialogOpen(false);
        setEditing(null);
        await loadChecklists();
      } catch (e: any) {
        console.error("Failed to save checklist", e);
        const message = e?.friendlyMessage || "Не удалось сохранить чек-лист";
        setDialogError(message);
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
                          const statusLabel = item.done
                            ? `✔ ${item.doneBy?.name ?? "Без автора"}`
                            : item.reservedBy
                              ? `🔒 ${item.reservedBy?.name ?? "Занято"}`
                              : "—";
                          return (
                            <div key={item.id} className="border-b border-subtle px-3 py-3 last:border-b-0">
                              <div className="flex items-start justify-between gap-3">
                                <ContentText
                                  className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${item.done ? "text-muted line-through" : "text-default"}`}
                                >
                                  {item.text}
                                </ContentText>
                                <div className="flex items-center gap-2">
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
                                      disabled={isBusy}
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
                              <div className="mt-2 text-xs text-muted">{statusLabel}</div>
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
    </Card>
  );
};

export default RestaurantChecklists;
