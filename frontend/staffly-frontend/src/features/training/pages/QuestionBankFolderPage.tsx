import { DndContext, DragOverlay, MeasuringStrategy, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Input from "../../../shared/ui/Input";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import QuestionDeleteGuardModal from "../components/QuestionDeleteGuardModal";
import QuestionEditorModal from "../components/QuestionEditorModal";
import TrainingArchiveModal, { type ArchivedTrainingObject } from "../components/TrainingArchiveModal";
import TrainingFolderModal from "../components/TrainingFolderModal";
import TrainingMoveModal from "../components/TrainingMoveModal";
import TrainingObjectList, { TrainingDragOverlayCard } from "../components/TrainingObjectList";
import TrainingSelectionToolbar from "../components/TrainingSelectionToolbar";
import TrainingToast from "../components/TrainingToast";
import { useSortableDnd } from "../../../shared/hooks/useSortableDnd";
import {
  deleteFolder,
  deleteQuestion,
  hideFolder,
  hideQuestion,
  listFolders,
  listQuestions,
  moveFolder,
  moveQuestion,
  reorderTrainingObjects,
  restoreFolder,
  restoreQuestion,
} from "../api/trainingApi";
import type { TrainingFolderDto, TrainingQuestionDto } from "../api/types";
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
import { buildQuestionDeleteDialogModel, type QuestionDeleteDialogModel } from "../utils/questionDeleteUx";
import { parseTrainingApiError } from "../utils/trainingApiError";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function QuestionBankFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "QUESTION_BANK", canManage });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sortableDnd = useSortableDnd({ scrollContainerRef });

  const [questions, setQuestions] = useState<TrainingQuestionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TrainingQuestionDto | null>(null);
  const [guardedQuestion, setGuardedQuestion] = useState<TrainingQuestionDto | null>(null);
  const [deleteDialogModel, setDeleteDialogModel] = useState<QuestionDeleteDialogModel | null>(null);
  const [guardActionLoading, setGuardActionLoading] = useState<"hideAndDelete" | "hideOnly" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeObject, setActiveObject] = useState<TrainingFolderListObject | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<TrainingMoveTarget | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveFolders, setArchiveFolders] = useState<TrainingFolderDto[]>([]);
  const [archiveQuestions, setArchiveQuestions] = useState<TrainingQuestionDto[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingPermanentDeleteTarget | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const folderMap = useMemo(() => new Map(foldersState.folders.map((folder) => [folder.id, folder])), [foldersState.folders]);
  const currentFolder = folderMap.get(currentFolderId) ?? null;
  const childFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId === currentFolderId),
    [currentFolderId, foldersState.folders],
  );
  const currentObjects = useMemo<TrainingFolderListObject[]>(
    () =>
      [
        ...childFolders.map((folder) => ({ kind: "folder" as const, id: folder.id, sortOrder: folder.sortOrder ?? 0, folder })),
        ...questions.map((question) => ({ kind: "question" as const, id: question.id, sortOrder: question.sortOrder ?? 0, question })),
      ].sort(sortTrainingObjects),
    [childFolders, questions],
  );
  const currentObjectIds = useMemo(
    () => currentObjects.map((object) => trainingObjectId(object.kind, object.id)),
    [currentObjects],
  );
  const selectedObject = useMemo(
    () => currentObjects.find((object) => trainingObjectId(object.kind, object.id) === selectedObjectId) ?? null,
    [currentObjects, selectedObjectId],
  );
  const blockedDropFolderIds = useMemo(() => {
    const parsed = sortableDnd.activeId ? parseTrainingObjectId(sortableDnd.activeId) : null;
    if (!parsed || parsed.kind !== "folder") return new Set<number>();
    return trainingDescendantIds(parsed.id, foldersState.folders);
  }, [foldersState.folders, sortableDnd.activeId]);

  const loadQuestions = useCallback(async () => {
    if (!restaurantId || !currentFolder) return;
    setLoading(true);
    setError(null);
    try {
      setQuestions(await listQuestions(restaurantId, currentFolder.id, false, debouncedSearch));
    } catch (loadError) {
      setError(getTrainingErrorMessage(loadError, "Не удалось загрузить вопросы папки."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, currentFolder, debouncedSearch]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const reloadVisible = useCallback(async () => {
    await Promise.all([foldersState.reload(), loadQuestions()]);
  }, [foldersState, loadQuestions]);

  const loadArchive = useCallback(async () => {
    if (!restaurantId) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const allFolders = await listFolders(restaurantId, "QUESTION_BANK", true);
      const questionsByFolder = await Promise.all(
        allFolders.map((folder) => listQuestions(restaurantId, folder.id, true).catch(() => [] as TrainingQuestionDto[])),
      );
      const uniqueQuestions = new Map(questionsByFolder.flat().map((question) => [question.id, question]));
      setArchiveFolders(allFolders);
      setArchiveQuestions([...uniqueQuestions.values()]);
    } catch (loadError) {
      setArchiveError(getTrainingErrorMessage(loadError, "Не удалось загрузить архив."));
    } finally {
      setArchiveLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (archiveOpen) void loadArchive();
  }, [archiveOpen, loadArchive]);

  const closeDeleteModal = useCallback(() => {
    if (guardActionLoading) return;
    setDeleteDialogModel(null);
    setGuardedQuestion(null);
  }, [guardActionLoading]);

  const handleHideAndDelete = useCallback(async () => {
    if (!restaurantId || !guardedQuestion) return;
    setGuardActionLoading("hideAndDelete");
    setError(null);
    try {
      await hideQuestion(restaurantId, guardedQuestion.id);
      await deleteQuestion(restaurantId, guardedQuestion.id);
      setToastMessage("Вопрос скрыт и удалён.");
      closeDeleteModal();
      await loadQuestions();
    } catch (deleteError) {
      const parsedError = parseTrainingApiError(deleteError);
      if (parsedError.status === 409) setDeleteDialogModel(buildQuestionDeleteDialogModel(parsedError));
      else setError(getTrainingErrorMessage(deleteError, "Не удалось скрыть и удалить вопрос."));
    } finally {
      setGuardActionLoading(null);
    }
  }, [restaurantId, guardedQuestion, closeDeleteModal, loadQuestions]);

  const handleHideOnly = useCallback(async () => {
    if (!restaurantId || !guardedQuestion) return;
    setGuardActionLoading("hideOnly");
    setError(null);
    try {
      await hideQuestion(restaurantId, guardedQuestion.id);
      setToastMessage("Вопрос скрыт.");
      closeDeleteModal();
      await loadQuestions();
    } catch (hideError) {
      setError(getTrainingErrorMessage(hideError, "Не удалось скрыть вопрос."));
    } finally {
      setGuardActionLoading(null);
    }
  }, [restaurantId, guardedQuestion, closeDeleteModal, loadQuestions]);

  const handleCopyExams = useCallback(async () => {
    if (!deleteDialogModel || deleteDialogModel.exams.length === 0) return;
    try {
      await navigator.clipboard.writeText(deleteDialogModel.exams.map((exam) => exam.title).join("\n"));
      setToastMessage("Список тестов скопирован.");
    } catch {
      setError("Не удалось скопировать список тестов.");
    }
  }, [deleteDialogModel]);

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; to?: string }[] = [
      { label: "Тренинг", to: trainingRoutes.landing },
      { label: "Банк вопросов", to: trainingRoutes.questionBank },
    ];
    if (!currentFolder) return items;
    const chain: TrainingFolderDto[] = [];
    let cursor: TrainingFolderDto | null = currentFolder;
    const seen = new Set<number>();
    while (cursor && !seen.has(cursor.id)) {
      chain.unshift(cursor);
      seen.add(cursor.id);
      cursor = cursor.parentId ? (folderMap.get(cursor.parentId) ?? null) : null;
    }
    chain.forEach((folder, index) =>
      items.push({
        label: folder.name,
        to: index === chain.length - 1 ? undefined : trainingRoutes.questionBankFolder(folder.id),
      }),
    );
    return items;
  }, [currentFolder, folderMap]);

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
    async (object: TrainingFolderListObject, targetFolderId: number | null) => {
      if (!restaurantId) return;
      if (object.kind === "folder") await moveFolder(restaurantId, object.id, { parentId: targetFolderId });
      else if (object.kind === "question" && targetFolderId != null) await moveQuestion(restaurantId, object.id, { folderId: targetFolderId });
    },
    [restaurantId],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const active = parseTrainingObjectId(String(event.active.id));
      const overId = event.over ? String(event.over.id) : null;
      const draggedObject = active ? currentObjects.find((object) => object.kind === active.kind && object.id === active.id) : null;
      finishDrag();
      if (!restaurantId || !active || !overId || !draggedObject) return;

      const dropFolderId = parseTrainingFolderDropId(overId);
      if (overId.startsWith("training-folder-drop:")) {
        if (dropFolderId === undefined) return;
        if (active.kind === "folder" && dropFolderId != null && blockedDropFolderIds.has(dropFolderId)) return;
        if (active.kind === "question" && dropFolderId == null) return;
        if (dropFolderId === currentFolderId) return;
        try {
          await moveObjectToFolder(draggedObject, dropFolderId);
          setSelectedObjectId(null);
          await reloadVisible();
        } catch (moveErrorValue) {
          setError(getTrainingErrorMessage(moveErrorValue, "Не удалось переместить объект."));
          await reloadVisible();
        }
        return;
      }

      const oldIndex = currentObjectIds.indexOf(trainingObjectId(active.kind, active.id));
      const newIndex = currentObjectIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const nextObjects = arrayMove(currentObjects, oldIndex, newIndex);
      try {
        await reorderTrainingObjects(restaurantId, {
          type: "QUESTION_BANK",
          folderId: currentFolderId,
          objects: nextObjects.map((object, index) => ({ kind: object.kind, id: object.id, sortOrder: index })),
        });
        await reloadVisible();
      } catch (reorderError) {
        setError(getTrainingErrorMessage(reorderError, "Не удалось сохранить порядок."));
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

  const archiveObject = async (object: TrainingFolderListObject) => {
    if (!restaurantId) return;
    setActionLoading(`archive-${object.kind}-${object.id}`);
    setError(null);
    try {
      if (object.kind === "folder") await hideFolder(restaurantId, object.id);
      else if (object.kind === "question") await hideQuestion(restaurantId, object.id);
      setSelectedObjectId(null);
      await reloadVisible();
    } catch (archiveErrorValue) {
      setError(getTrainingErrorMessage(archiveErrorValue, "Не удалось переместить в архив."));
    } finally {
      setActionLoading(null);
    }
  };

  const restoreArchived = async (object: ArchivedTrainingObject) => {
    if (!restaurantId) return;
    setActionLoading(`restore-${object.kind}-${object.id}`);
    try {
      if (object.kind === "folder") await restoreFolder(restaurantId, object.id);
      else if (object.kind === "question") await restoreQuestion(restaurantId, object.id);
      await Promise.all([reloadVisible(), loadArchive()]);
    } catch (restoreError) {
      setArchiveError(getTrainingErrorMessage(restoreError, "Не удалось восстановить."));
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
        await Promise.all(archiveQuestions.filter((question) => !question.active).map((question) => deleteQuestion(restaurantId, question.id)));
      } else if (deleteTarget.kind === "folder") await deleteFolder(restaurantId, deleteTarget.id);
      else if (deleteTarget.kind === "question") await deleteQuestion(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await Promise.all([reloadVisible(), loadArchive()]);
    } catch (deleteError) {
      const parsedError = parseTrainingApiError(deleteError);
      if (deleteTarget.kind === "question" && parsedError.status === 409) {
        const question = archiveQuestions.find((archiveQuestion) => archiveQuestion.id === deleteTarget.id) ?? null;
        setGuardedQuestion(question);
        setDeleteDialogModel(buildQuestionDeleteDialogModel(parsedError));
        setArchiveOpen(false);
        return;
      }
      setArchiveError(getTrainingErrorMessage(deleteError, "Не удалось удалить навсегда."));
    } finally {
      setActionLoading(null);
    }
  };

  if (Number.isNaN(currentFolderId)) {
    return <ErrorState message="Папка не найдена" actionLabel="К списку" onRetry={() => navigate(trainingRoutes.questionBank)} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{currentFolder?.name ?? "Папка"}</h2>

      {canManage ? (
        <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setArchiveOpen(true)}>
              Архив
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingFolder(null);
                  setFolderModalOpen(true);
                }}
              >
                Создать папку
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingQuestion(null);
                  setQuestionModalOpen(true);
                }}
              >
                Создать вопрос
              </Button>
            </div>
          </div>
          <Input label="Поиск по вопросам" placeholder="Поиск по вопросам" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      ) : null}

      {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
      {loading && <LoadingState label="Загрузка вопросов…" />}
      {error && <ErrorState message={error} onRetry={loadQuestions} />}
      {!foldersState.loading && !loading && currentObjects.length === 0 ? (
        <EmptyState title="Здесь пока пусто" description="Создайте папку или вопрос." />
      ) : null}

      {currentObjects.length > 0 ? (
        <DndContext sensors={sortableDnd.sensors} collisionDetection={trainingCollisionDetection} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={handleDragStart} onDragMove={sortableDnd.handleDragMove} onDragEnd={(event) => void handleDragEnd(event)} onDragCancel={finishDrag}>
          <div ref={scrollContainerRef}>
            <SortableContext items={currentObjectIds} strategy={verticalListSortingStrategy}>
              <TrainingObjectList
                objects={currentObjects}
                activeObjectId={sortableDnd.activeId}
                selectedObjectId={selectedObjectId}
                blockedFolderIds={blockedDropFolderIds}
                actionLoading={actionLoading}
                canManage={canManage}
                onSelectObject={(object) => setSelectedObjectId(trainingObjectId(object.kind, object.id))}
                onClearSelection={() => setSelectedObjectId(null)}
                onOpenObject={(object) => {
                  if (object.kind === "folder") navigate(trainingRoutes.questionBankFolder(object.id));
                  else if (object.kind === "question") {
                    setEditingQuestion(object.question);
                    setQuestionModalOpen(true);
                  }
                }}
                onEditObject={(object) => {
                  if (object.kind === "folder") {
                    setEditingFolder(object.folder);
                    setFolderModalOpen(true);
                  } else if (object.kind === "question") {
                    setEditingQuestion(object.question);
                    setQuestionModalOpen(true);
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
        onOpen={(object) => {
          if (object.kind === "folder") navigate(trainingRoutes.questionBankFolder(object.id));
          else if (object.kind === "question") {
            setEditingQuestion(object.question);
            setQuestionModalOpen(true);
          }
        }}
        onEditFolder={(folder) => {
          setEditingFolder(folder);
          setFolderModalOpen(true);
        }}
        onEditKnowledgeItem={() => undefined}
        onEditQuestion={(question) => {
          setEditingQuestion(question);
          setQuestionModalOpen(true);
        }}
        onEditPracticeExam={() => undefined}
        onMove={(object) => setMoveTarget({ kind: object.kind, id: object.id, title: trainingObjectTitle(object) })}
        onArchive={(object) => void archiveObject(object)}
        onClear={() => setSelectedObjectId(null)}
      />

      <TrainingMoveModal
        target={moveTarget}
        type="QUESTION_BANK"
        folders={foldersState.folders}
        currentFolderId={currentFolderId}
        submitting={moveSubmitting}
        error={moveError}
        onClose={() => {
          if (moveSubmitting) return;
          setMoveTarget(null);
          setMoveError(null);
        }}
        onSubmit={async (targetFolderId) => {
          if (!moveTarget) return;
          const object = currentObjects.find((item) => item.kind === moveTarget.kind && item.id === moveTarget.id);
          if (!object) return;
          setMoveSubmitting(true);
          setMoveError(null);
          try {
            await moveObjectToFolder(object, targetFolderId);
            setMoveTarget(null);
            setSelectedObjectId(null);
            await reloadVisible();
          } catch (submitError) {
            setMoveError(getTrainingErrorMessage(submitError, "Не удалось переместить."));
          } finally {
            setMoveSubmitting(false);
          }
        }}
      />

      {restaurantId && currentFolder ? (
        <TrainingFolderModal
          open={folderModalOpen}
          mode={editingFolder ? "edit" : "create"}
          restaurantId={restaurantId}
          type="QUESTION_BANK"
          parentFolder={editingFolder ? (editingFolder.parentId ? (folderMap.get(editingFolder.parentId) ?? null) : null) : currentFolder}
          initialFolder={editingFolder}
          onClose={() => setFolderModalOpen(false)}
          onSaved={foldersState.reload}
        />
      ) : null}
      {restaurantId && currentFolder ? (
        <QuestionEditorModal
          open={questionModalOpen}
          restaurantId={restaurantId}
          folderId={currentFolder.id}
          question={editingQuestion}
          onClose={() => setQuestionModalOpen(false)}
          onSaved={loadQuestions}
        />
      ) : null}

      <TrainingArchiveModal
        open={archiveOpen}
        folders={archiveFolders}
        questions={archiveQuestions}
        loading={archiveLoading}
        error={archiveError}
        actionLoading={actionLoading}
        onClose={() => setArchiveOpen(false)}
        onRestore={(object) => void restoreArchived(object)}
        onDelete={(object) => setDeleteTarget({ kind: object.kind, id: object.id, title: object.title })}
        onDeleteAll={() => setDeleteTarget({ kind: "all", title: "все элементы архива" })}
      />

      <ConfirmDialog open={Boolean(deleteTarget)} title="Удалить навсегда" description="Элементы архива будут удалены безвозвратно." confirmText="Удалить навсегда" confirming={Boolean(actionLoading?.startsWith("delete-"))} onCancel={() => setDeleteTarget(null)} onConfirm={() => void runPermanentDelete()} />

      <QuestionDeleteGuardModal
        open={Boolean(deleteDialogModel)}
        mode={deleteDialogModel?.mode ?? "GENERIC"}
        message={deleteDialogModel?.message ?? "Не удалось удалить вопрос."}
        exams={deleteDialogModel?.exams ?? []}
        loadingAction={guardActionLoading}
        onClose={closeDeleteModal}
        onHideAndDelete={() => void handleHideAndDelete()}
        onHideOnly={() => void handleHideOnly()}
        onOpenExams={() => navigate(trainingRoutes.exams)}
        onOpenExam={(exam) => {
          if (exam.mode === "PRACTICE" && exam.knowledgeFolderId != null) navigate(trainingRoutes.knowledgeExamRun(exam.knowledgeFolderId, exam.id));
          else navigate(trainingRoutes.examRun(exam.id));
        }}
        onCopyExamList={() => void handleCopyExams()}
      />

      <TrainingToast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
