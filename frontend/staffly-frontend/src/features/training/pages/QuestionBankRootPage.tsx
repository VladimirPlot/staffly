import { DndContext, DragOverlay, MeasuringStrategy, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import TrainingArchiveModal, { type ArchivedTrainingObject } from "../components/TrainingArchiveModal";
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
import type { TrainingFolderListObject, TrainingMoveTarget, TrainingPermanentDeleteTarget } from "../trainingFolderObjects";
import { trainingObjectTitle } from "../trainingFolderObjects";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

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
  const objectIds = useMemo(() => rootObjects.map((object) => trainingObjectId(object.kind, object.id)), [rootObjects]);
  const selectedObject = useMemo(
    () => rootObjects.find((object) => trainingObjectId(object.kind, object.id) === selectedObjectId) ?? null,
    [rootObjects, selectedObjectId],
  );
  const blockedDropFolderIds = useMemo(() => {
    const parsed = sortableDnd.activeId ? parseTrainingObjectId(sortableDnd.activeId) : null;
    if (!parsed || parsed.kind !== "folder") return new Set<number>();
    return trainingDescendantIds(parsed.id, foldersState.folders);
  }, [foldersState.folders, sortableDnd.activeId]);

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

      const nextObjects = arrayMove(rootObjects, oldIndex, newIndex);
      try {
        await reorderTrainingObjects(restaurantId, {
          type: "QUESTION_BANK",
          folderId: null,
          objects: nextObjects.map((object, index) => ({ kind: object.kind, id: object.id, sortOrder: index })),
        });
        await reload();
      } catch (reorderError) {
        setError(getTrainingErrorMessage(reorderError, "Не удалось сохранить порядок."));
        await reload();
      }
    },
    [blockedDropFolderIds, finishDrag, objectIds, reload, restaurantId, rootObjects],
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
        await Promise.all(archiveFolders.filter((folder) => !folder.active).map((folder) => deleteFolder(restaurantId, folder.id)));
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
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Банк вопросов" }]} />
      <h2 className="text-2xl font-semibold">Банк вопросов</h2>
      {canManage ? (
        <div className="border-subtle bg-surface flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
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
            className="text-muted hover:text-red-600"
            title="Корзина"
            aria-label="Открыть корзину банка вопросов"
            leftIcon={<Icon icon={Trash2} size="sm" decorative />}
            onClick={() => setArchiveOpen(true)}
          />
        </div>
      ) : null}
      {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {error && <ErrorState message={error} onRetry={foldersState.reload} />}
      {!foldersState.loading && rootObjects.length === 0 && <EmptyState title="Папок пока нет" description="Создайте первую папку для вопросов." />}
      {rootObjects.length > 0 ? (
        <DndContext sensors={sortableDnd.sensors} collisionDetection={trainingCollisionDetection} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={handleDragStart} onDragMove={sortableDnd.handleDragMove} onDragEnd={(event) => void handleDragEnd(event)} onDragCancel={finishDrag}>
          <div ref={scrollContainerRef}>
            <SortableContext items={objectIds} strategy={verticalListSortingStrategy}>
              <TrainingObjectList
                objects={rootObjects}
                activeObjectId={sortableDnd.activeId}
                selectedObjectId={selectedObjectId}
                blockedFolderIds={blockedDropFolderIds}
                actionLoading={actionLoading}
                canManage={canManage}
                onSelectObject={(object) => setSelectedObjectId(trainingObjectId(object.kind, object.id))}
                onClearSelection={() => setSelectedObjectId(null)}
                onOpenObject={(object) => navigate(trainingRoutes.questionBankFolder(object.id))}
                onEditObject={(object) => {
                  if (object.kind === "folder") {
                    setEditingFolder(object.folder);
                    setModalOpen(true);
                  }
                }}
                onMoveObject={(object) => setMoveTarget({ kind: object.kind, id: object.id, title: trainingObjectTitle(object) })}
                onArchiveObject={(object) => void archiveObject(object)}
              />
            </SortableContext>
          </div>
          <DragOverlay dropAnimation={null} modifiers={[centerTrainingDragOverlayOnCursor]}>
            <TrainingDragOverlayCard object={activeObject} width={dragOverlayWidth} />
          </DragOverlay>
        </DndContext>
      ) : null}

      <TrainingSelectionToolbar
        object={selectedObject}
        visible={Boolean(selectedObject)}
        actionLoading={actionLoading}
        canManage={canManage}
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

      <ConfirmDialog open={Boolean(deleteTarget)} title="Удалить навсегда" description="Элементы корзины будут удалены безвозвратно." confirmText="Удалить навсегда" confirming={Boolean(actionLoading?.startsWith("delete-"))} onCancel={() => setDeleteTarget(null)} onConfirm={() => void runPermanentDelete()} />

      {restaurantId ? (
        <TrainingFolderModal open={modalOpen} mode={editingFolder ? "edit" : "create"} restaurantId={restaurantId} type="QUESTION_BANK" initialFolder={editingFolder} onClose={() => setModalOpen(false)} onSaved={foldersState.reload} />
      ) : null}
    </div>
  );
}
