import { DndContext, DragOverlay, MeasuringStrategy, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import KnowledgeHeader from "../components/KnowledgeHeader";
import LoadingState from "../components/LoadingState";
import TrainingArchiveModal, { type ArchivedTrainingObject } from "../components/TrainingArchiveModal";
import TrainingMoveModal from "../components/TrainingMoveModal";
import TrainingObjectList, { TrainingDragOverlayCard } from "../components/TrainingObjectList";
import TrainingSelectionToolbar from "../components/TrainingSelectionToolbar";
import { useSortableDnd } from "../../../shared/hooks/useSortableDnd";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import {
  deleteExam,
  deleteFolder,
  deleteKnowledgeItem,
  hideFolder,
  hideKnowledgeItem,
  hideExam,
  listFolders,
  listKnowledgeExams,
  listKnowledgeItems,
  moveFolder,
  moveKnowledgeItem,
  movePracticeExam,
  reorderTrainingObjects,
  restoreExam,
  restoreFolder,
  restoreKnowledgeItem,
} from "../api/trainingApi";
import type { TrainingExamDto, TrainingFolderDto, TrainingKnowledgeItemDto } from "../api/types";
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
import { trainingObjectTitle } from "../trainingFolderObjects";
import { getTrainingErrorMessage } from "../utils/errors";
import { getPracticeExamStatus } from "../utils/practiceExamStatus";
import { trainingRoutes } from "../utils/trainingRoutes";
import { useKnowledgeBreadcrumbs } from "./knowledge/KnowledgeBreadcrumbs";
import KnowledgeModals from "./knowledge/KnowledgeModals";
import { useKnowledgePageState } from "./knowledge/useKnowledgePageState";

type Props = {
  currentFolderId: number | null;
};

export default function KnowledgePageBase({ currentFolderId }: Props) {
  const { restaurantId, canManage } = useTrainingAccess();
  const state = useKnowledgePageState({ currentFolderId, restaurantId: restaurantId ?? undefined, canManage });
  const breadcrumbItems = useKnowledgeBreadcrumbs(state.currentFolder, state.folderMap);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sortableDnd = useSortableDnd({ scrollContainerRef });
  const [activeObject, setActiveObject] = useState<TrainingFolderListObject | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [toolbarObjectId, setToolbarObjectId] = useState<string | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [moveTarget, setMoveTarget] = useState<TrainingMoveTarget | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveFolders, setArchiveFolders] = useState<TrainingFolderDto[]>([]);
  const [archiveItems, setArchiveItems] = useState<TrainingKnowledgeItemDto[]>([]);
  const [archiveExams, setArchiveExams] = useState<TrainingExamDto[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingPermanentDeleteTarget | null>(null);

  const currentObjects = useMemo<TrainingFolderListObject[]>(
    () =>
      [
        ...state.childFolders.map((folder) => ({
          kind: "folder" as const,
          id: folder.id,
          sortOrder: folder.sortOrder ?? 0,
          folder,
        })),
        ...state.items.map((item) => ({
          kind: "knowledgeItem" as const,
          id: item.id,
          sortOrder: item.sortOrder ?? 0,
          item,
        })),
        ...state.practiceExams.map((exam) => ({
          kind: "practiceExam" as const,
          id: exam.id,
          sortOrder: exam.sortOrder ?? 0,
          exam,
        })),
      ].sort(sortTrainingObjects),
    [state.childFolders, state.items, state.practiceExams],
  );
  const currentObjectIds = useMemo(
    () => currentObjects.map((object) => trainingObjectId(object.kind, object.id)),
    [currentObjects],
  );
  const toolbarObject = useMemo(
    () => currentObjects.find((object) => trainingObjectId(object.kind, object.id) === toolbarObjectId) ?? null,
    [currentObjects, toolbarObjectId],
  );
  const blockedDropFolderIds = useMemo(() => {
    const parsed = sortableDnd.activeId ? parseTrainingObjectId(sortableDnd.activeId) : null;
    if (!parsed || parsed.kind !== "folder") return new Set<number>();
    return trainingDescendantIds(parsed.id, state.foldersState.folders);
  }, [state.foldersState.folders, sortableDnd.activeId]);
  const practiceStatusByExamId = useMemo(
    () =>
      new Map(
        state.practiceExams.map((exam) => [
          exam.id,
          getPracticeExamStatus(exam.id, state.progressByExamId.get(exam.id), state.inProgressExamIds),
        ]),
      ),
    [state.inProgressExamIds, state.practiceExams, state.progressByExamId],
  );
  const runRouteByExamId = useMemo(
    () =>
      new Map(
        state.practiceExams.map((exam) => [
          exam.id,
          currentFolderId == null ? null : trainingRoutes.knowledgeExamRun(currentFolderId, exam.id),
        ]),
      ),
    [currentFolderId, state.practiceExams],
  );

  const reloadVisible = useCallback(async () => {
    await Promise.all([state.foldersState.reload(), state.loadItems(), state.loadPracticeExams()]);
  }, [state]);

  const loadArchive = useCallback(async () => {
    if (!restaurantId || !canManage) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const allFolders = await listFolders(restaurantId, "KNOWLEDGE", true);
      const folderIds = [null, ...allFolders.map((folder) => folder.id)] as Array<number | null>;
      const itemsByFolder = await Promise.all(
        folderIds.map((folderId) => listKnowledgeItems(restaurantId, folderId ?? undefined, true)),
      );
      const examsByFolder = await Promise.all(
        allFolders.map((folder) =>
          listKnowledgeExams(restaurantId, folder.id, true).catch(() => [] as TrainingExamDto[]),
        ),
      );
      const uniqueItems = new Map(itemsByFolder.flat().map((item) => [item.id, item]));
      const uniqueExams = new Map(examsByFolder.flat().map((exam) => [exam.id, exam]));
      setArchiveFolders(allFolders);
      setArchiveItems([...uniqueItems.values()]);
      setArchiveExams([...uniqueExams.values()]);
    } catch (error) {
      setArchiveError(getTrainingErrorMessage(error, "Не удалось загрузить архив."));
    } finally {
      setArchiveLoading(false);
    }
  }, [canManage, restaurantId]);

  useEffect(() => {
    if (archiveOpen) void loadArchive();
  }, [archiveOpen, loadArchive]);

  useEffect(() => {
    if (selectedObjectId && !currentObjectIds.includes(selectedObjectId)) {
      setSelectedObjectId(null);
    }
  }, [currentObjectIds, selectedObjectId]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let frameId: number | null = null;

    if (selectedObjectId) {
      setToolbarObjectId(selectedObjectId);
      frameId = window.requestAnimationFrame(() => setToolbarVisible(true));
    } else {
      setToolbarVisible(false);
      timeoutId = window.setTimeout(() => setToolbarObjectId(null), 160);
    }

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [selectedObjectId]);

  useEffect(() => {
    if (!selectedObjectId) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          [
            "[data-training-object-card]",
            "[data-training-selection-toolbar]",
            "[data-overlay-root]",
            "[role='menu']",
            "[role='dialog']",
          ].join(","),
        )
      ) {
        return;
      }
      setSelectedObjectId(null);
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  }, [selectedObjectId]);

  const finishDrag = useCallback(() => {
    sortableDnd.finishDrag();
    setActiveObject(null);
    setDragOverlayWidth(null);
  }, [sortableDnd]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      sortableDnd.handleDragStart(event);
      const activeId = String(event.active.id);
      setActiveObject(currentObjects.find((object) => trainingObjectId(object.kind, object.id) === activeId) ?? null);
      setDragOverlayWidth(event.active.rect.current.initial?.width ?? null);
    },
    [currentObjects, sortableDnd],
  );

  const moveObjectToFolder = useCallback(
    async (object: TrainingFolderListObject, folderId: number | null) => {
      if (!restaurantId) return;
      if (object.kind === "folder") await moveFolder(restaurantId, object.id, { parentId: folderId });
      else if (object.kind === "knowledgeItem") await moveKnowledgeItem(restaurantId, object.id, { folderId });
      else if (object.kind === "practiceExam" && folderId != null) {
        await movePracticeExam(restaurantId, object.id, { knowledgeFolderId: folderId });
      }
    },
    [restaurantId],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const active = parseTrainingObjectId(String(event.active.id));
      const overId = event.over ? String(event.over.id) : null;
      const draggedObject = active
        ? currentObjects.find((object) => object.kind === active.kind && object.id === active.id)
        : null;
      finishDrag();
      if (!restaurantId || !active || !overId || !draggedObject) return;

      setActionError(null);
      const dropFolderId = parseTrainingFolderDropId(overId);
      if (overId.startsWith("training-folder-drop:")) {
        if (dropFolderId === undefined) return;
        if (active.kind === "folder" && dropFolderId != null && blockedDropFolderIds.has(dropFolderId)) return;
        if (active.kind === "practiceExam" && dropFolderId == null) return;
        if (dropFolderId === currentFolderId) return;

        try {
          await moveObjectToFolder(draggedObject, dropFolderId);
          setSelectedObjectId(null);
          await reloadVisible();
        } catch (error) {
          setActionError(getTrainingErrorMessage(error, "Не удалось переместить объект."));
          await reloadVisible();
        }
        return;
      }

      const oldIndex = currentObjectIds.indexOf(trainingObjectId(active.kind, active.id));
      const newIndex = currentObjectIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const nextObjects = arrayMove(currentObjects, oldIndex, newIndex).map((object, index) => ({
        ...object,
        sortOrder: index,
      }));

      try {
        await reorderTrainingObjects(restaurantId, {
          type: "KNOWLEDGE",
          folderId: currentFolderId,
          objects: nextObjects.map((object, index) => ({
            kind: object.kind,
            id: object.id,
            sortOrder: index,
          })),
        });
        await reloadVisible();
      } catch (error) {
        setActionError(getTrainingErrorMessage(error, "Не удалось сохранить порядок."));
        await reloadVisible();
      }
    },
    [
      blockedDropFolderIds,
      currentFolderId,
      currentObjectIds,
      currentObjects,
      finishDrag,
      moveObjectToFolder,
      reloadVisible,
      restaurantId,
    ],
  );

  const openObject = useCallback(
    (object: TrainingFolderListObject) => {
      setSelectedObjectId(null);
      if (object.kind === "folder") state.navigate(trainingRoutes.knowledgeFolder(object.id));
      else if (object.kind === "practiceExam" && currentFolderId != null) {
        state.navigate(trainingRoutes.knowledgeExamRun(currentFolderId, object.id));
      } else if (object.kind === "knowledgeItem") {
        state.openEditItemModal(object.item);
      }
    },
    [currentFolderId, state],
  );

  const editObject = useCallback(
    (object: TrainingFolderListObject) => {
      if (object.kind === "folder") {
        state.setEditingFolder(object.folder);
        state.setFolderModalOpen(true);
      } else if (object.kind === "knowledgeItem") {
        state.openEditItemModal(object.item);
      } else if (object.kind === "practiceExam") {
        state.setEditingExam(object.exam);
        state.setExamModalOpen(true);
      }
    },
    [state],
  );

  const startMove = useCallback((object: TrainingFolderListObject) => {
    setMoveError(null);
    setMoveTarget({ kind: object.kind, id: object.id, title: trainingObjectTitle(object) });
  }, []);

  const submitMove = useCallback(
    async (folderId: number | null) => {
      if (!moveTarget) return;
      const object = currentObjects.find((item) => item.kind === moveTarget.kind && item.id === moveTarget.id);
      if (!object) return;
      setMoveSubmitting(true);
      setMoveError(null);
      try {
        await moveObjectToFolder(object, folderId);
        setSelectedObjectId(null);
        setMoveTarget(null);
        await reloadVisible();
      } catch (error) {
        setMoveError(getTrainingErrorMessage(error, "Не удалось переместить."));
      } finally {
        setMoveSubmitting(false);
      }
    },
    [currentObjects, moveObjectToFolder, moveTarget, reloadVisible],
  );

  const archiveObject = useCallback(
    async (object: TrainingFolderListObject) => {
      if (!restaurantId) return;
      setActionLoading(`archive-${object.kind}-${object.id}`);
      setActionError(null);
      try {
        if (object.kind === "folder") await hideFolder(restaurantId, object.id);
        else if (object.kind === "knowledgeItem") await hideKnowledgeItem(restaurantId, object.id);
        else if (object.kind === "practiceExam") await hideExam(restaurantId, object.id);
        setSelectedObjectId(null);
        await reloadVisible();
      } catch (error) {
        setActionError(getTrainingErrorMessage(error, "Не удалось переместить в архив."));
      } finally {
        setActionLoading(null);
      }
    },
    [reloadVisible, restaurantId],
  );

  const restoreArchived = useCallback(
    async (object: ArchivedTrainingObject) => {
      if (!restaurantId) return;
      setActionLoading(`restore-${object.kind}-${object.id}`);
      setArchiveError(null);
      try {
        if (object.kind === "folder") await restoreFolder(restaurantId, object.id);
        else if (object.kind === "knowledgeItem") await restoreKnowledgeItem(restaurantId, object.id);
        else if (object.kind === "practiceExam") await restoreExam(restaurantId, object.id);
        await Promise.all([reloadVisible(), loadArchive()]);
      } catch (error) {
        setArchiveError(getTrainingErrorMessage(error, "Не удалось восстановить."));
      } finally {
        setActionLoading(null);
      }
    },
    [loadArchive, reloadVisible, restaurantId],
  );

  const runPermanentDelete = useCallback(async () => {
    if (!restaurantId || !deleteTarget) return;
    setActionLoading(deleteTarget.kind === "all" ? "delete-all" : `delete-${deleteTarget.kind}-${deleteTarget.id}`);
    setArchiveError(null);
    try {
      if (deleteTarget.kind === "all") {
        await Promise.all(archiveFolders.filter((folder) => !folder.active).map((folder) => deleteFolder(restaurantId, folder.id)));
        await Promise.all(archiveItems.filter((item) => !item.active).map((item) => deleteKnowledgeItem(restaurantId, item.id)));
        await Promise.all(archiveExams.filter((exam) => !exam.active).map((exam) => deleteExam(restaurantId, exam.id)));
      } else if (deleteTarget.kind === "folder") await deleteFolder(restaurantId, deleteTarget.id);
      else if (deleteTarget.kind === "knowledgeItem") await deleteKnowledgeItem(restaurantId, deleteTarget.id);
      else if (deleteTarget.kind === "practiceExam") await deleteExam(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await Promise.all([reloadVisible(), loadArchive()]);
    } catch (error) {
      setArchiveError(getTrainingErrorMessage(error, "Не удалось удалить навсегда."));
    } finally {
      setActionLoading(null);
    }
  }, [archiveExams, archiveFolders, archiveItems, deleteTarget, loadArchive, reloadVisible, restaurantId]);

  if (state.showFolderNotFound) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Breadcrumbs items={breadcrumbItems} />
        <ErrorState
          message="Папка не найдена или недоступна"
          actionLabel="К списку"
          onRetry={() => state.navigate(trainingRoutes.knowledge)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{state.currentFolder?.name ?? "База знаний"}</h2>

      <KnowledgeHeader
        canManage={canManage}
        includeInactive={false}
        onToggleIncludeInactive={() => setArchiveOpen(true)}
        positions={state.visiblePositions}
        positionFilter={state.positionFilter}
        onChangePositionFilter={state.setPositionFilter}
        onCreateFolder={state.openCreateFolderModal}
        onCreateCard={state.openCreateItemModal}
        onCreateTest={state.openCreateExamModal}
      />

      {state.foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {state.foldersState.error && <ErrorState message={state.foldersState.error} onRetry={state.foldersState.reload} />}
      {state.folderError && <ErrorState message={state.folderError} onRetry={state.foldersState.reload} />}
      {state.itemsError && <ErrorState message={state.itemsError} onRetry={state.loadItems} />}
      {state.examsError && <ErrorState message={state.examsError} onRetry={state.loadPracticeExams} />}
      {actionError && <ErrorState message={actionError} onRetry={reloadVisible} />}

      {(state.itemsLoading || state.examsLoading) && <LoadingState label="Загрузка материалов…" />}

      {!state.foldersState.loading && !state.itemsLoading && !state.examsLoading && currentObjects.length > 0 ? (
        <DndContext
          sensors={sortableDnd.sensors}
          collisionDetection={trainingCollisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart}
          onDragMove={sortableDnd.handleDragMove}
          onDragEnd={(event) => void handleDragEnd(event)}
          onDragCancel={finishDrag}
        >
          <div ref={scrollContainerRef}>
            <SortableContext items={currentObjectIds} strategy={verticalListSortingStrategy}>
              <TrainingObjectList
                objects={currentObjects}
                activeObjectId={sortableDnd.activeId}
                selectedObjectId={selectedObjectId}
                blockedFolderIds={blockedDropFolderIds}
                actionLoading={actionLoading}
                canManage={canManage}
                progressByExamId={state.progressByExamId}
                practiceStatusByExamId={practiceStatusByExamId}
                runRouteByExamId={runRouteByExamId}
                onSelectObject={(object) => setSelectedObjectId(trainingObjectId(object.kind, object.id))}
                onClearSelection={() => setSelectedObjectId(null)}
                onOpenObject={openObject}
                onEditObject={editObject}
                onMoveObject={startMove}
                onArchiveObject={(object) => void archiveObject(object)}
                onRunPracticeExam={(exam) => {
                  if (currentFolderId != null) state.navigate(trainingRoutes.knowledgeExamRun(currentFolderId, exam.id));
                }}
              />
            </SortableContext>
          </div>
          <DragOverlay dropAnimation={null} modifiers={[centerTrainingDragOverlayOnCursor]}>
            <TrainingDragOverlayCard object={activeObject} width={dragOverlayWidth} />
          </DragOverlay>
        </DndContext>
      ) : null}

      {state.isCompletelyEmpty && (
        <EmptyState title="Пока пусто" description="Создайте папку или карточку." />
      )}

      <KnowledgeModals
        restaurantId={state.restaurantId}
        currentFolderId={currentFolderId}
        folderMap={state.folderMap}
        currentFolder={state.currentFolder}
        folderModalOpen={state.folderModalOpen}
        editingFolder={state.editingFolder}
        onCloseFolderModal={() => {
          state.setEditingFolder(null);
          state.setFolderModalOpen(false);
        }}
        onSavedFolder={state.foldersState.reload}
        examModalOpen={state.examModalOpen}
        editingExam={state.editingExam}
        onCloseExamModal={() => {
          state.setEditingExam(null);
          state.setExamModalOpen(false);
        }}
        onSavedExam={state.loadPracticeExams}
        knowledgeModalOpen={state.knowledgeModalOpen}
        knowledgeModalMode={state.knowledgeModalMode}
        editingItem={state.editingItem}
        onCloseKnowledgeModal={() => state.setKnowledgeModalOpen(false)}
        onSavedKnowledge={state.loadItems}
      />

      <TrainingSelectionToolbar
        object={toolbarObject}
        visible={toolbarVisible}
        actionLoading={actionLoading}
        canManage={canManage}
        onOpen={openObject}
        onEditFolder={(folder) => {
          state.setEditingFolder(folder);
          state.setFolderModalOpen(true);
        }}
        onEditKnowledgeItem={state.openEditItemModal}
        onEditQuestion={() => undefined}
        onEditPracticeExam={(exam) => {
          state.setEditingExam(exam);
          state.setExamModalOpen(true);
        }}
        onMove={startMove}
        onArchive={(object) => void archiveObject(object)}
        onClear={() => setSelectedObjectId(null)}
      />

      <TrainingMoveModal
        target={moveTarget}
        type="KNOWLEDGE"
        folders={state.foldersState.folders}
        currentFolderId={currentFolderId}
        submitting={moveSubmitting}
        error={moveError}
        onClose={() => {
          if (moveSubmitting) return;
          setMoveTarget(null);
          setMoveError(null);
        }}
        onSubmit={(folderId) => void submitMove(folderId)}
      />

      <TrainingArchiveModal
        open={archiveOpen}
        folders={archiveFolders}
        knowledgeItems={archiveItems}
        practiceExams={archiveExams}
        loading={archiveLoading}
        error={archiveError}
        actionLoading={actionLoading}
        onClose={() => {
          setArchiveOpen(false);
          setArchiveError(null);
        }}
        onRestore={(object) => void restoreArchived(object)}
        onDelete={(object) => setDeleteTarget({ kind: object.kind, id: object.id, title: object.title })}
        onDeleteAll={() => setDeleteTarget({ kind: "all", title: "все элементы архива" })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить навсегда"
        description={
          deleteTarget?.kind === "all"
            ? "Все элементы архива будут удалены безвозвратно."
            : "Элемент будет удалён безвозвратно."
        }
        confirming={Boolean(actionLoading?.startsWith("delete-"))}
        confirmText="Удалить навсегда"
        onCancel={() => {
          if (actionLoading?.startsWith("delete-")) return;
          setDeleteTarget(null);
          setArchiveError(null);
        }}
        onConfirm={() => void runPermanentDelete()}
      />
    </div>
  );
}
