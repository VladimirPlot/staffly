import { DndContext, DragOverlay, MeasuringStrategy, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FolderTree, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import TrainingArchiveModal, { type ArchivedTrainingObject } from "../components/TrainingArchiveModal";
import TrainingBreadcrumbs from "../components/TrainingBreadcrumbs";
import TrainingFolderModal from "../components/TrainingFolderModal";
import TrainingMoveModal from "../components/TrainingMoveModal";
import TrainingObjectList, { TrainingDragOverlayCard } from "../components/TrainingObjectList";
import TrainingSelectionToolbar from "../components/TrainingSelectionToolbar";
import { useSortableDnd } from "../../../shared/hooks/useSortableDnd";
import {
  deleteFolder,
  hideFolder,
  listFolders,
  moveFolder,
  reorderTrainingObjects,
  restoreFolder,
} from "../api/trainingApi";
import type { TrainingFolderDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import {
  centerTrainingDragOverlayOnCursor,
  parseTrainingFolderDropId,
  parseTrainingObjectId,
  sortTrainingObjects,
  trainingCollisionDetection,
  trainingDescendantIds,
  trainingObjectId,
} from "../trainingFolderDnd";
import type {
  TrainingFolderListObject,
  TrainingMoveTarget,
  TrainingPermanentDeleteTarget,
} from "../trainingFolderObjects";
import { trainingObjectActive, trainingObjectTitle } from "../trainingFolderObjects";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

function formatFolderCount(count: number) {
  const remainder10 = count % 10;
  const remainder100 = count % 100;
  if (remainder10 === 1 && remainder100 !== 11) return `${count} папка`;
  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) return `${count} папки`;
  return `${count} папок`;
}

export default function QuestionBankRootPage() {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "QUESTION_BANK", canManage });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sortableDnd = useSortableDnd({ scrollContainerRef });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeObject, setActiveObject] = useState<TrainingFolderListObject | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<TrainingMoveTarget | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveFolders, setArchiveFolders] = useState<TrainingFolderDto[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingPermanentDeleteTarget | null>(null);

  const rootObjects = useMemo<TrainingFolderListObject[]>(
    () =>
      foldersState.folders
        .filter((folder) => folder.parentId === null)
        .map((folder) => ({ kind: "folder" as const, id: folder.id, sortOrder: folder.sortOrder ?? 0, folder }))
        .sort(sortTrainingObjects),
    [foldersState.folders],
  );
  const activeRootFolders = useMemo(() => rootObjects.filter(trainingObjectActive), [rootObjects]);
  const folderReorderEnabled = canManage
    && activeRootFolders.length > 1
    && activeRootFolders.every((object) => object.kind === "folder" && object.folder.manageable);
  const objectIds = useMemo(
    () => folderReorderEnabled ? activeRootFolders.map((object) => trainingObjectId(object.kind, object.id)) : [],
    [activeRootFolders, folderReorderEnabled],
  );
  const selectedObject = useMemo(
    () => rootObjects.find((object) => trainingObjectId(object.kind, object.id) === selectedObjectId) ?? null,
    [rootObjects, selectedObjectId],
  );
  const blockedDropFolderIds = useMemo(() => {
    const parsed = sortableDnd.activeId ? parseTrainingObjectId(sortableDnd.activeId) : null;
    if (!parsed || parsed.kind !== "folder") return new Set<number>();
    return trainingDescendantIds(parsed.id, foldersState.folders);
  }, [foldersState.folders, sortableDnd.activeId]);

  const openQuestionBankRoot = useCallback(() => {
    setSelectedObjectId(null);
    navigate(trainingRoutes.questionBank);
  }, [navigate]);

  const openQuestionBankFolder = useCallback(
    (folderId: number) => {
      setSelectedObjectId(null);
      navigate(trainingRoutes.questionBankFolder(folderId));
    },
    [navigate],
  );

  const reload = useCallback(async () => {
    await foldersState.reload();
  }, [foldersState]);

  const loadArchive = useCallback(async () => {
    if (!restaurantId) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      setArchiveFolders(await listFolders(restaurantId, "QUESTION_BANK", true));
    } catch (loadError) {
      setArchiveError(getTrainingErrorMessage(loadError, "Не удалось загрузить корзину."));
    } finally {
      setArchiveLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (archiveOpen) void loadArchive();
  }, [archiveOpen, loadArchive]);

  const finishDrag = useCallback(() => {
    sortableDnd.finishDrag();
    setActiveObject(null);
    setDragOverlayWidth(null);
  }, [sortableDnd]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      sortableDnd.handleDragStart(event);
      const activeId = String(event.active.id);
      setActiveObject(rootObjects.find((object) => trainingObjectId(object.kind, object.id) === activeId) ?? null);
      setDragOverlayWidth(event.active.rect.current.initial?.width ?? null);
    },
    [rootObjects, sortableDnd],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const active = parseTrainingObjectId(String(event.active.id));
      const overId = event.over ? String(event.over.id) : null;
      finishDrag();
      if (!restaurantId || !active || !overId) return;

      const dropFolderId = parseTrainingFolderDropId(overId);
      if (overId.startsWith("training-folder-drop:")) {
        if (dropFolderId === undefined) return;
        if (active.kind === "folder" && dropFolderId != null && blockedDropFolderIds.has(dropFolderId)) return;
        try {
          await moveFolder(restaurantId, active.id, { parentId: dropFolderId });
          setSelectedObjectId(null);
          await reload();
        } catch (moveErrorValue) {
          setError(getTrainingErrorMessage(moveErrorValue, "Не удалось переместить папку."));
          await reload();
        }
        return;
      }

      const oldIndex = objectIds.indexOf(trainingObjectId(active.kind, active.id));
      const newIndex = objectIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      if (!folderReorderEnabled) return;
      const activeFolders = activeRootFolders;
      const activeOldIndex = activeFolders.findIndex((object) => object.id === active.id);
      const over = parseTrainingObjectId(overId);
      const activeNewIndex = activeFolders.findIndex((object) => object.id === over?.id);
      if (activeOldIndex === -1 || activeNewIndex === -1) return;
      const nextObjects = arrayMove(activeFolders, activeOldIndex, activeNewIndex);
      try {
        await reorderTrainingObjects(restaurantId, {
          type: "QUESTION_BANK",
          folderId: null,
          kind: "FOLDER",
          orderedIds: nextObjects.map((object) => object.id),
        });
        await reload();
      } catch (reorderError) {
        setError(getTrainingErrorMessage(reorderError, "Не удалось сохранить порядок."));
        await reload();
      }
    },
    [activeRootFolders, blockedDropFolderIds, finishDrag, folderReorderEnabled, objectIds, reload, restaurantId],
  );

  const archiveObject = async (object: TrainingFolderListObject) => {
    if (!restaurantId || object.kind !== "folder") return;
    setActionLoading(`archive-folder-${object.id}`);
    setError(null);
    try {
      await hideFolder(restaurantId, object.id);
      setSelectedObjectId(null);
      await reload();
    } catch (archiveErrorValue) {
      setError(getTrainingErrorMessage(archiveErrorValue, "Не удалось переместить папку в корзину."));
    } finally {
      setActionLoading(null);
    }
  };

  const restoreArchived = async (object: ArchivedTrainingObject) => {
    if (!restaurantId || object.kind !== "folder") return;
    setActionLoading(`restore-folder-${object.id}`);
    try {
      await restoreFolder(restaurantId, object.id);
      await Promise.all([reload(), loadArchive()]);
    } catch (restoreError) {
      setArchiveError(getTrainingErrorMessage(restoreError, "Не удалось восстановить папку."));
    } finally {
      setActionLoading(null);
    }
  };

  const runPermanentDelete = async () => {
    if (!restaurantId || !deleteTarget) return;
    setActionLoading(deleteTarget.kind === "all" ? "delete-all" : `delete-${deleteTarget.kind}-${deleteTarget.id}`);
    try {
      if (deleteTarget.kind === "all") {
        await Promise.all(
          archiveFolders.filter((folder) => !folder.active).map((folder) => deleteFolder(restaurantId, folder.id)),
        );
      } else if (deleteTarget.kind === "folder") {
        await deleteFolder(restaurantId, deleteTarget.id);
      }
      setDeleteTarget(null);
      await Promise.all([reload(), loadArchive()]);
    } catch (deleteError) {
      setArchiveError(getTrainingErrorMessage(deleteError, "Не удалось удалить навсегда."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <DndContext
        sensors={sortableDnd.sensors}
        collisionDetection={trainingCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragMove={sortableDnd.handleDragMove}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={finishDrag}
      >
        <TrainingBreadcrumbs
          ariaLabel="Путь к банку вопросов"
          rootLabel="Банк вопросов"
          currentFolderId={null}
          folderChain={[]}
          activeObjectId={sortableDnd.activeId}
          blockedFolderIds={blockedDropFolderIds}
          rootDropDisabledObjectKinds={["practiceExam", "question"]}
          onOpenRoot={openQuestionBankRoot}
          onOpenFolder={openQuestionBankFolder}
        />
        <h2 className="text-2xl font-semibold">Банк вопросов</h2>
        {canManage ? (
          <div className="border-subtle bg-surface grid gap-3 overflow-hidden rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-strong inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)] ring-1 ring-[color:var(--staffly-divider)]/70 ring-inset">
                <Icon icon={FolderTree} size="sm" decorative />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-strong text-sm font-semibold">Корень банка вопросов</span>
                  <span className="border-subtle bg-app text-muted inline-flex rounded-full border px-2 py-0.5 text-xs">
                    {formatFolderCount(rootObjects.length)}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-muted text-xs">Структура папок для вопросов</span>
                  <span className="flex items-center" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--staffly-text-strong)]/45" />
                    <span className="h-px w-4 bg-[color:var(--staffly-divider)]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--staffly-text-strong)]/30" />
                    <span className="h-px w-4 bg-[color:var(--staffly-divider)]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--staffly-text-strong)]/20" />
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  setEditingFolder(null);
                  setModalOpen(true);
                }}
              >
                Создать папку
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="text-muted shrink-0 hover:text-red-600"
                title="Корзина"
                aria-label="Открыть корзину банка вопросов"
                leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                onClick={() => setArchiveOpen(true)}
              />
            </div>
          </div>
        ) : null}
        {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
        {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
        {error && <ErrorState message={error} onRetry={foldersState.reload} />}
        {!foldersState.loading && rootObjects.length === 0 && (
          <EmptyState title="Папок пока нет" description="Создайте первую папку для вопросов." />
        )}
        {rootObjects.length > 0 ? (
          <div ref={scrollContainerRef}>
            <SortableContext items={objectIds} strategy={verticalListSortingStrategy}>
              <TrainingObjectList
                objects={rootObjects}
                activeObjectId={sortableDnd.activeId}
                selectedObjectId={selectedObjectId}
                blockedFolderIds={blockedDropFolderIds}
                actionLoading={actionLoading}
                canManage={canManage}
                canManageObject={(object) => object.kind !== "folder" || object.folder.manageable}
                canReorderObject={(object) => folderReorderEnabled && trainingObjectActive(object)}
                onSelectObject={(object) => setSelectedObjectId(trainingObjectId(object.kind, object.id))}
                onClearSelection={() => setSelectedObjectId(null)}
                onOpenObject={(object) => navigate(trainingRoutes.questionBankFolder(object.id))}
                onEditObject={(object) => {
                  if (object.kind === "folder") {
                    setEditingFolder(object.folder);
                    setModalOpen(true);
                  }
                }}
                onMoveObject={(object) =>
                  setMoveTarget({ kind: object.kind, id: object.id, title: trainingObjectTitle(object) })
                }
                onArchiveObject={(object) => void archiveObject(object)}
              />
            </SortableContext>
          </div>
        ) : null}
        <DragOverlay dropAnimation={null} modifiers={[centerTrainingDragOverlayOnCursor]}>
          <TrainingDragOverlayCard object={activeObject} width={dragOverlayWidth} />
        </DragOverlay>
      </DndContext>

      <TrainingSelectionToolbar
        object={selectedObject}
        visible={Boolean(selectedObject)}
        actionLoading={actionLoading}
        canManage={canManage && (selectedObject?.kind !== "folder" || selectedObject.folder.manageable)}
        onOpen={(object) => navigate(trainingRoutes.questionBankFolder(object.id))}
        onEditFolder={(folder) => {
          setEditingFolder(folder);
          setModalOpen(true);
        }}
        onEditKnowledgeItem={() => undefined}
        onEditQuestion={() => undefined}
        onEditPracticeExam={() => undefined}
        onMove={(object) => setMoveTarget({ kind: object.kind, id: object.id, title: trainingObjectTitle(object) })}
        onArchive={(object) => void archiveObject(object)}
        onClear={() => setSelectedObjectId(null)}
      />

      <TrainingMoveModal
        target={moveTarget}
        type="QUESTION_BANK"
        folders={foldersState.folders}
        currentFolderId={null}
        submitting={moveSubmitting}
        error={moveError}
        onClose={() => {
          if (moveSubmitting) return;
          setMoveTarget(null);
          setMoveError(null);
        }}
        onSubmit={async (folderId) => {
          if (!restaurantId || !moveTarget) return;
          setMoveSubmitting(true);
          setMoveError(null);
          try {
            await moveFolder(restaurantId, moveTarget.id, { parentId: folderId });
            setMoveTarget(null);
            setSelectedObjectId(null);
            await reload();
          } catch (submitError) {
            setMoveError(getTrainingErrorMessage(submitError, "Не удалось переместить."));
          } finally {
            setMoveSubmitting(false);
          }
        }}
      />

      <TrainingArchiveModal
        open={archiveOpen}
        title="Корзина"
        loadingText="Загружаем корзину..."
        emptyText="Корзина пуста."
        folders={archiveFolders}
        loading={archiveLoading}
        error={archiveError}
        actionLoading={actionLoading}
        onClose={() => setArchiveOpen(false)}
        onRestore={(object) => void restoreArchived(object)}
        onDelete={(object) => setDeleteTarget({ kind: object.kind, id: object.id, title: object.title })}
        onDeleteAll={() => setDeleteTarget({ kind: "all", title: "все элементы корзины" })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить навсегда"
        description="Элементы корзины будут удалены безвозвратно."
        confirmText="Удалить навсегда"
        confirming={Boolean(actionLoading?.startsWith("delete-"))}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void runPermanentDelete()}
      />

      {restaurantId ? (
        <TrainingFolderModal
          open={modalOpen}
          mode={editingFolder ? "edit" : "create"}
          restaurantId={restaurantId}
          type="QUESTION_BANK"
          initialFolder={editingFolder}
          onClose={() => setModalOpen(false)}
          onSaved={foldersState.reload}
        />
      ) : null}
    </div>
  );
}
