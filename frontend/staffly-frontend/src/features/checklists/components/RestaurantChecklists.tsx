import React from "react";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import {
  createChecklist,
  deleteChecklist,
  downloadChecklist,
  listChecklists,
  updateChecklist,
  type ChecklistDto,
  type ChecklistRequest,
} from "../api";
import ChecklistDialog from "./ChecklistDialog";

export type RestaurantChecklistsProps = {
  restaurantId: number;
  canManage: boolean;
};

const RestaurantChecklists: React.FC<RestaurantChecklistsProps> = ({ restaurantId, canManage }) => {
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [checklists, setChecklists] = React.useState<ChecklistDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [positionFilter, setPositionFilter] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogSubmitting, setDialogSubmitting] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<ChecklistDto | null>(null);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [downloadMenuFor, setDownloadMenuFor] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ChecklistDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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
      setDownloadMenuFor(null);
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
    setDialogOpen(true);
  }, []);

  const openEditDialog = React.useCallback((checklist: ChecklistDto) => {
    setEditing(checklist);
    setDialogError(null);
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
        }
        setDialogOpen(false);
        setEditing(null);
        await loadChecklists();
      } catch (e: any) {
        console.error("Failed to save checklist", e);
        const message = e?.response?.data?.message || "Не удалось сохранить чек-лист";
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

  const toggleDownloadMenu = React.useCallback((id: number) => {
    setDownloadMenuFor((prev) => (prev === id ? null : id));
  }, []);

  React.useEffect(() => {
    if (!dialogOpen) {
      setDialogError(null);
    }
  }, [dialogOpen]);

  React.useEffect(() => {
    if (downloadMenuFor == null) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest?.("[data-download-menu]") && !target.closest?.("[data-download-trigger]")) {
        setDownloadMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [downloadMenuFor]);

  const handleDownload = React.useCallback(
    async (checklist: ChecklistDto, format: "txt" | "docx") => {
      try {
        const blob = await downloadChecklist(restaurantId, checklist.id, format);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const safeName =
          checklist.name.replace(/[^0-9a-zA-Zа-яА-ЯёЁ _.-]+/g, "").trim() || `checklist-${checklist.id}`;
        link.download = format === "docx" ? `${safeName}.docx` : `${safeName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Failed to download checklist", e);
      } finally {
        setDownloadMenuFor(null);
      }
    },
    [restaurantId]
  );

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

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-zinc-900">Чек-листы</div>
          <div className="text-sm text-zinc-600">Готовые инструкции для сотрудников по должностям</div>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            Создать чек-лист
          </Button>
        )}
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="rounded-2xl border border-zinc-300 bg-white p-2 text-sm"
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
            return (
              <div key={checklist.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-base font-semibold text-zinc-900">{checklist.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{assignedNames}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2" data-download-trigger>
                    <Button variant="ghost" onClick={() => toggleExpanded(checklist.id)} className="text-sm text-zinc-600">
                      {isExpanded ? "Свернуть" : "Открыть"}
                    </Button>
                    <div className="relative">
                      <Button variant="outline" onClick={() => toggleDownloadMenu(checklist.id)} className="text-sm">
                        Скачать
                      </Button>
                      {downloadMenuFor === checklist.id && (
                        <div
                          className="absolute right-0 z-20 mt-2 w-36 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl"
                          data-download-menu
                        >
                          <button
                            type="button"
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                            onClick={() => handleDownload(checklist, "txt")}
                          >
                            Скачать .txt
                          </button>
                          <button
                            type="button"
                            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                            onClick={() => handleDownload(checklist, "docx")}
                          >
                            Скачать .docx
                          </button>
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <Button variant="ghost" onClick={() => openEditDialog(checklist)} className="text-sm text-zinc-600">
                        Редактировать
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" onClick={() => openDeleteDialog(checklist)} className="text-sm text-red-600">
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                    {checklist.content}
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
        initialData={
          editing
            ? {
                name: editing.name,
                content: editing.content,
                positionIds: editing.positions.map((p) => p.id),
              }
            : undefined
        }
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
