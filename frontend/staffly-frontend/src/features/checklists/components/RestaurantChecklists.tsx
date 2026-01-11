import React from "react";
import { Download, Pencil, Trash2 } from "lucide-react";

import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import {
  createChecklist,
  deleteChecklist,
  listChecklists,
  resetChecklist,
  updateChecklist,
  updateChecklistProgress,
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

const RestaurantChecklists: React.FC<RestaurantChecklistsProps> = ({ restaurantId, canManage }) => {
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [checklists, setChecklists] = React.useState<ChecklistDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [positionFilter, setPositionFilter] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogSubmitting, setDialogSubmitting] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = React.useState<ChecklistDialogInitial | undefined>(undefined);
  const [editing, setEditing] = React.useState<ChecklistDto | null>(null);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<ChecklistDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [progressDrafts, setProgressDrafts] = React.useState<Map<number, Set<number>>>(new Map());
  const [progressSaving, setProgressSaving] = React.useState<number | null>(null);
  const [resetting, setResetting] = React.useState<number | null>(null);
  const [downloading, setDownloading] = React.useState<number | null>(null);
  const [downloadMenuFor, setDownloadMenuFor] = React.useState<number | null>(null);
  const [createKind, setCreateKind] = React.useState<ChecklistKind>("TRACKABLE");

  const checklistRefs = React.useRef<Map<number, HTMLDivElement | null>>(new Map());
  const downloadMenuRefs = React.useRef<Map<number, HTMLDivElement | null>>(new Map());

  const loadPositions = React.useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await listPositions(restaurantId, { includeInactive: true });
      setPositions(data);
    } catch (e) {
      console.error("Failed to load positions", e);
    }
  }, [restaurantId]);

  const loadChecklists = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listChecklists(restaurantId, canManage && positionFilter ? { positionId: positionFilter } : undefined);
      setChecklists(data);
      const drafts = new Map<number, Set<number>>();
      data.forEach((cl) => {
        if (cl.kind === "TRACKABLE") {
          drafts.set(
            cl.id,
            new Set(cl.items.filter((item) => item.done).map((item) => item.id))
          );
        }
      });
      setProgressDrafts(drafts);
    } catch (e) {
      console.error("Failed to load checklists", e);
      setError("Не удалось загрузить чек-листы");
      setChecklists([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canManage, positionFilter]);

  React.useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  React.useEffect(() => {
    void loadChecklists();
  }, [loadChecklists]);

  const openCreateDialog = React.useCallback(() => {
    setEditing(null);
    setDialogError(null);

    setDialogInitial({
      kind: createKind,
      name: "",
      content: "",
      positionIds: [],
      periodicity: createKind === "TRACKABLE" ? "DAILY" : undefined,
      items: [""],
    });

    setDialogOpen(true);
  }, [createKind]);

  const openEditDialog = React.useCallback((checklist: ChecklistDto) => {
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

  const closeDialog = React.useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSubmitDialog = React.useCallback(
    async (payload: ChecklistRequest) => {
      if (!restaurantId) return;
      setDialogSubmitting(true);
      setDialogError(null);

      try {
        if (editing) {
          await updateChecklist(restaurantId, editing.id, payload);
        } else {
          await createChecklist(restaurantId, payload);
          setCreateKind(payload.kind); // запомнили последний выбранный тип
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

  const toggleExpanded = React.useCallback((id: number) => {
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

  const openDeleteDialog = React.useCallback((checklist: ChecklistDto) => {
    setDeleteTarget(checklist);
  }, []);

  const closeDeleteDialog = React.useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = React.useCallback(async () => {
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

  const resetFilter = React.useCallback(() => {
    setPositionFilter(null);
  }, []);

  const positionNames = React.useMemo(() => {
    const map = new Map<number, string>();
    positions.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [positions]);

  const handleToggleItem = React.useCallback(
    (checklistId: number, itemId: number, done: boolean) => {
      if (done) return;
      setProgressDrafts((prev) => {
        const next = new Map(prev);
        const current = new Set(next.get(checklistId) ?? []);
        current.add(itemId);
        next.set(checklistId, current);
        return next;
      });
    },
    []
  );

  const handleSaveProgress = React.useCallback(
    async (checklist: ChecklistDto) => {
      if (progressSaving) return;
      const selected = progressDrafts.get(checklist.id) ?? new Set<number>();
      setProgressSaving(checklist.id);
      try {
        await updateChecklistProgress(restaurantId, checklist.id, Array.from(selected));
        await loadChecklists();
      } catch (e) {
        console.error("Failed to update progress", e);
      } finally {
        setProgressSaving(null);
      }
    },
    [progressDrafts, restaurantId, progressSaving, loadChecklists]
  );

  const handleReset = React.useCallback(
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

  const handleDownloadJpg = React.useCallback(
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

  const setChecklistRef = React.useCallback((id: number, node: HTMLDivElement | null) => {
    checklistRefs.current.set(id, node);
  }, []);

  const setDownloadMenuRef = React.useCallback((id: number, node: HTMLDivElement | null) => {
    downloadMenuRefs.current.set(id, node);
  }, []);

  const toggleDownloadMenu = React.useCallback((checklistId: number) => {
    setDownloadMenuFor((current) => (current === checklistId ? null : checklistId));
  }, []);

  React.useEffect(() => {
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

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {canManage && (
              <div className="flex flex-wrap gap-2">
                {/* ОДНА кнопка */}
                <Button onClick={openCreateDialog}>Создать чек-лист</Button>
              </div>
            )}
          </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="rounded-2xl border border-zinc-300 bg-white p-2 text-base"
            value={positionFilter ?? ""}
            onChange={(event) => setPositionFilter(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Все должности</option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetFilter}
            className={`flex items-center gap-1 rounded-full border border-transparent p-2 text-sm transition ${
              positionFilter == null ? "text-zinc-300" : "text-zinc-500 hover:text-zinc-700"
            }`}
            aria-label="Сбросить фильтр"
            disabled={positionFilter == null}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M20 4L4 20" />
            </svg>
            <span>Сбросить</span>
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading && <div className="text-sm text-zinc-500">Загрузка чек-листов…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && checklists.length === 0 && (
          <div className="text-sm text-zinc-500">Чек-листы пока не добавлены.</div>
        )}
        {!loading && !error &&
          checklists.map((checklist) => {
            const isExpanded = expanded.has(checklist.id);
            const assignedNames = checklist.positions.length
              ? checklist.positions.map((p) => p.name || positionNames.get(p.id) || `Должность #${p.id}`).join(", ")
              : "—";
            const draft = progressDrafts.get(checklist.id) ?? new Set<number>();
            const isTrackable = checklist.kind === "TRACKABLE";
            const isSaving = progressSaving === checklist.id;
            const isResetting = resetting === checklist.id;
            const isDownloading = downloading === checklist.id;
            return (
              <div
                key={checklist.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4"
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
                      <div className="text-base font-semibold text-zinc-900">{checklist.name}</div>
                    </div>
                    {isTrackable && checklist.periodLabel && (
                      <div className="text-sm text-zinc-700">{checklist.periodLabel}</div>
                    )}
                    <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{assignedNames}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" onClick={() => toggleExpanded(checklist.id)} className="text-sm text-zinc-600">
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
                          className="text-zinc-700"
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
                            className="absolute right-0 z-10 mt-2 w-36 rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-sm text-zinc-700"
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
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(checklist)}
                        className="text-zinc-600"
                        aria-label="Редактировать"
                      >
                        <Icon icon={Pencil} />
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(checklist)}
                        className="text-red-600 hover:bg-red-50"
                        aria-label="Удалить"
                      >
                        <Icon icon={Trash2} />
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                    {isTrackable ? (
                      <div className="space-y-3">
                        {checklist.items.map((item) => {
                          const checked = item.done || draft.has(item.id);
                          return (
                            <label key={item.id} className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={item.done}
                                onChange={() => handleToggleItem(checklist.id, item.id, item.done)}
                                className="mt-0.5 h-4 w-4 rounded border-zinc-400 text-amber-500 focus:ring-amber-500"
                              />
                              <ContentText
                                className={`min-w-0 ${item.done ? "text-zinc-400 line-through" : "text-zinc-800"}`}
                              >
                                {item.text}
                              </ContentText>
                            </label>
                          );
                        })}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleSaveProgress(checklist)}
                            disabled={isSaving}
                            className="text-sm"
                          >
                            {isSaving ? "Сохраняем…" : "Сохранить"}
                          </Button>
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
                      <ContentText>{checklist.content ?? ""}</ContentText>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <ChecklistDialog
        open={dialogOpen}
        title={editing ? "Редактирование чек-листа" : "Новый чек-лист"}
        positions={positions}
        initialData={dialogInitial}
        isEditMode={Boolean(editing)}
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
