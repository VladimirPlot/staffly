import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import KnowledgeHeader from "../components/KnowledgeHeader";
import ExamEditorModal from "../components/ExamEditorModal";
import KnowledgeItemModal from "../components/KnowledgeItemModal";
import KnowledgeItemsGrid from "../components/KnowledgeItemsGrid";
import LoadingState from "../components/LoadingState";
import TrainingFolderModal from "../components/TrainingFolderModal";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { mapExamsForUi, mapKnowledgeItemsForUi } from "../api/mappers";
import {
  deleteExam,
  deleteFolder,
  deleteKnowledgeItem,
  getExamProgress,
  hideExam,
  hideKnowledgeItem,
  listKnowledgeExams,
  listKnowledgeItems,
  restoreExam,
  restoreKnowledgeItem,
} from "../api/trainingApi";
import type {
  ExamProgressDto,
  TrainingExamDto,
  TrainingFolderDto,
  TrainingKnowledgeItemDto,
} from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

type Props = {
  currentFolderId: number | null;
};

type ItemAction = "hide" | "restore" | "delete";
type ExamAction = "hide" | "restore" | "delete";

function getExamRunStorageKey(examId: number) {
  return `training_exam_run_${examId}`;
}

function hasInProgressExamAttempt(examId: number) {
  try {
    return Boolean(localStorage.getItem(getExamRunStorageKey(examId)));
  } catch {
    return false;
  }
}

function getPracticeExamStatus(
  examId: number,
  progress: ExamProgressDto | undefined,
  inProgressIds: Set<number>,
) {
  if (inProgressIds.has(examId)) return "IN_PROGRESS";
  if (!progress) return null;
  return progress.passed ? "PASSED" : "FAILED";
}

export default function KnowledgePageBase({ currentFolderId }: Props) {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });

  const [items, setItems] = useState<TrainingKnowledgeItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [knowledgeModalMode, setKnowledgeModalMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<TrainingKnowledgeItemDto | null>(null);
  const [itemActionLoadingId, setItemActionLoadingId] = useState<number | null>(null);
  const [itemActionLoadingType, setItemActionLoadingType] = useState<ItemAction | null>(null);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [practiceExams, setPracticeExams] = useState<TrainingExamDto[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [examActionLoadingId, setExamActionLoadingId] = useState<number | null>(null);

  const folderMap = useMemo(() => new Map(foldersState.folders.map((folder) => [folder.id, folder])), [foldersState.folders]);
  const currentFolder = currentFolderId == null ? null : folderMap.get(currentFolderId) ?? null;

  const [examProgress, setExamProgress] = useState<ExamProgressDto[]>([]);
  const [inProgressExamIds, setInProgressExamIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!restaurantId || !canManage) return;
    void listPositions(restaurantId, { includeInactive: false }).then(setPositions).catch(() => setPositions([]));
  }, [restaurantId, canManage]);

  const positionNameById = useMemo(
    () => new Map(positions.map((position) => [position.id, position.name])),
    [positions]
  );

  const progressByExamId = useMemo(
    () => new Map(examProgress.map((item) => [item.examId, item])),
    [examProgress]
  );

  const visiblePositions = useMemo(() => {
    if (!currentFolder || currentFolder.visibilityPositionIds.length === 0) return positions;
    const allowed = new Set(currentFolder.visibilityPositionIds);
    return positions.filter((position) => allowed.has(position.id));
  }, [positions, currentFolder]);

  const childFolders = useMemo(() => {
    const children = foldersState.folders.filter((folder) => folder.parentId === currentFolderId);
    const filtered = !positionFilter
      ? children
      : children.filter(
          (folder) => folder.visibilityPositionIds.length === 0 || folder.visibilityPositionIds.includes(positionFilter)
        );
    return filtered.sort(bySortOrderAndName);
  }, [foldersState.folders, currentFolderId, positionFilter]);

  const loadItems = useCallback(async () => {
    if (!restaurantId) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await listKnowledgeItems(restaurantId, currentFolderId ?? undefined, canManage ? foldersState.includeInactive : false);
      setItems(mapKnowledgeItemsForUi(response));
    } catch (error) {
      setItemsError(getTrainingErrorMessage(error, "Не удалось загрузить карточки."));
    } finally {
      setItemsLoading(false);
    }
  }, [restaurantId, currentFolderId, canManage, foldersState.includeInactive]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadPracticeExams = useCallback(async () => {
    if (!restaurantId || currentFolderId == null) {
      setPracticeExams([]);
      return;
    }
    setExamsLoading(true);
    setExamsError(null);
    try {
      const response = await listKnowledgeExams(restaurantId, currentFolderId, canManage ? foldersState.includeInactive : false);
      setPracticeExams(mapExamsForUi(response));
    } catch (error) {
      setExamsError(getTrainingErrorMessage(error, "Не удалось загрузить тесты."));
    } finally {
      setExamsLoading(false);
    }
  }, [restaurantId, currentFolderId, canManage, foldersState.includeInactive]);

  const loadExamProgress = useCallback(async () => {
    if (!restaurantId) {
      setExamProgress([]);
      return;
    }

    try {
      const response = await getExamProgress(restaurantId);
      setExamProgress(response);
    } catch {
      setExamProgress([]);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadPracticeExams();
  }, [loadPracticeExams]);

  const refreshInProgressExamIds = useCallback(() => {
    setInProgressExamIds(new Set(practiceExams.filter((exam) => hasInProgressExamAttempt(exam.id)).map((exam) => exam.id)));
  }, [practiceExams]);

  useEffect(() => {
    void loadExamProgress();
  }, [loadExamProgress]);

  useEffect(() => {
    refreshInProgressExamIds();
  }, [refreshInProgressExamIds]);

  useEffect(() => {
    const handleFocus = () => refreshInProgressExamIds();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshInProgressExamIds();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshInProgressExamIds]);

  const breadcrumbItems = useMemo(() => {
    const crumbs: { label: string; to?: string }[] = [
      { label: "Тренинг", to: trainingRoutes.landing },
      { label: "База знаний", to: trainingRoutes.knowledge },
    ];
    if (!currentFolder) return crumbs;

    const chain: TrainingFolderDto[] = [];
    const seen = new Set<number>();
    let cursor: TrainingFolderDto | null = currentFolder;
    while (cursor && !seen.has(cursor.id)) {
      chain.unshift(cursor);
      seen.add(cursor.id);
      cursor = cursor.parentId ? folderMap.get(cursor.parentId) ?? null : null;
    }

    chain.forEach((folder, index) => {
      const isLast = index === chain.length - 1;
      crumbs.push({ label: folder.name, to: isLast ? undefined : `${trainingRoutes.knowledge}/${folder.id}` });
    });
    return crumbs;
  }, [currentFolder, folderMap]);

  const runDelete = async (folderIdToDelete: number) => {
    if (!restaurantId) return;
    const deletingFolder = folderMap.get(folderIdToDelete) ?? null;
    setActionLoadingId(folderIdToDelete);
    setFolderError(null);
    try {
      await deleteFolder(restaurantId, folderIdToDelete);
      await foldersState.reload();
      if (folderIdToDelete === currentFolderId) {
        navigate(deletingFolder?.parentId ? `${trainingRoutes.knowledge}/${deletingFolder.parentId}` : trainingRoutes.knowledge);
      }
    } catch (error) {
      setFolderError(getTrainingErrorMessage(error, "Не удалось удалить папку."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const openCreateItemModal = () => {
    setEditingItem(null);
    setKnowledgeModalMode("create");
    setKnowledgeModalOpen(true);
  };

  const openEditItemModal = (item: TrainingKnowledgeItemDto) => {
    setEditingItem(item);
    setKnowledgeModalMode("edit");
    setKnowledgeModalOpen(true);
  };

  const runItemAction = async (itemId: number, action: ItemAction) => {
    if (!restaurantId) return;
    setItemActionLoadingId(itemId);
    setItemActionLoadingType(action);
    setItemsError(null);
    try {
      if (action === "hide") await hideKnowledgeItem(restaurantId, itemId);
      else if (action === "restore") await restoreKnowledgeItem(restaurantId, itemId);
      else await deleteKnowledgeItem(restaurantId, itemId);
      await loadItems();
    } catch (error) {
      setItemsError(getTrainingErrorMessage(error, "Не удалось выполнить действие с карточкой."));
    } finally {
      setItemActionLoadingId(null);
      setItemActionLoadingType(null);
    }
  };

  const runExamAction = async (examId: number, action: ExamAction) => {
    if (!restaurantId) return;
    setExamActionLoadingId(examId);
    setExamsError(null);

    try {
      if (action === "hide") {
        await hideExam(restaurantId, examId);
      } else if (action === "restore") {
        await restoreExam(restaurantId, examId);
      } else {
        await deleteExam(restaurantId, examId);
      }

      await Promise.all([loadPracticeExams(), loadExamProgress()]);
      refreshInProgressExamIds();
    } catch (error) {
      setExamsError(getTrainingErrorMessage(error, "Не удалось выполнить действие с тестом."));
    } finally {
      setExamActionLoadingId(null);
    }
  };

  const showFolderNotFound = currentFolderId !== null && !foldersState.loading && !foldersState.error && !currentFolder;

  if (showFolderNotFound) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Breadcrumbs items={breadcrumbItems} />
        <ErrorState message="Папка не найдена или недоступна" actionLabel="К списку" onRetry={() => navigate(trainingRoutes.knowledge)} />
      </div>
    );
  }

  const isCompletelyEmpty =
    !childFolders.length &&
    !items.length &&
    !practiceExams.length &&
    !foldersState.loading &&
    !foldersState.error &&
    !itemsLoading &&
    !itemsError &&
    !examsLoading &&
    !examsError;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{currentFolder?.name ?? "База знаний"}</h2>

      <KnowledgeHeader
        canManage={canManage}
        includeInactive={foldersState.includeInactive}
        onToggleIncludeInactive={foldersState.setIncludeInactive}
        positions={visiblePositions}
        positionFilter={positionFilter}
        onChangePositionFilter={setPositionFilter}
        onCreateFolder={() => { setEditingFolder(null); setFolderModalOpen(true); }}
        onCreateCard={openCreateItemModal}
        onCreateTest={() => { if (currentFolderId == null) { setExamsError("Выберите папку базы знаний, чтобы создать учебный тест."); return; } setEditingExam(null); setExamModalOpen(true); }}
      />

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {folderError && <ErrorState message={folderError} onRetry={foldersState.reload} />}

      {childFolders.length > 0 && (
        <FolderList
          folders={childFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          positionNameById={positionNameById}
          onOpen={(id) => navigate(`${trainingRoutes.knowledge}/${id}`)}
          onEdit={(folder) => { setEditingFolder(folder); setFolderModalOpen(true); }}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      {(examsLoading || examsError || practiceExams.length > 0) && (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Практические тесты</h3>

          {examsLoading && <LoadingState label="Загрузка тестов…" />}
          {examsError && <ErrorState message={examsError} onRetry={loadPracticeExams} />}

          {!examsLoading && !examsError && practiceExams.length > 0 && (
            <div className="space-y-3">
              {practiceExams.map((exam) => {
                const isBusy = examActionLoadingId === exam.id;
                const progress = progressByExamId.get(exam.id);
                const status = getPracticeExamStatus(exam.id, progress, inProgressExamIds);

                return (
                  <div
                    key={exam.id}
                    className="border-subtle bg-app rounded-2xl border p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-default">{exam.title}</div>

                          {status === "PASSED" && (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                              Пройден
                            </span>
                          )}

                          {status === "FAILED" && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                              Не пройден
                            </span>
                          )}

                          {status === "IN_PROGRESS" && (
                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700">
                              Запущен
                            </span>
                          )}

                          {!exam.active && (
                            <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                              Скрыт
                            </span>
                          )}
                        </div>

                        {exam.description && (
                          <div className="text-sm text-muted">{exam.description}</div>
                        )}

                        <div className="text-sm text-muted">
                          Вопросов: {exam.questionCount} · Проходной балл: {exam.passPercent}%
                          {typeof progress?.scorePercent === "number"
                            ? ` · Последний результат: ${progress.scorePercent}%`
                            : ""}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                        {canManage && (
                          <>
                            <IconButton
                              aria-label="Редактировать тест"
                              title="Редактировать"
                              onClick={() => {
                                setEditingExam(exam);
                                setExamModalOpen(true);
                              }}
                              disabled={isBusy}
                            >
                              <Icon icon={Pencil} size="sm" />
                            </IconButton>

                            {exam.active ? (
                              <IconButton
                                aria-label="Скрыть тест"
                                title="Скрыть"
                                onClick={() => runExamAction(exam.id, "hide")}
                                disabled={isBusy}
                              >
                                <Icon icon={EyeOff} size="sm" />
                              </IconButton>
                            ) : (
                              <IconButton
                                aria-label="Восстановить тест"
                                title="Восстановить"
                                onClick={() => runExamAction(exam.id, "restore")}
                                disabled={isBusy}
                              >
                                <Icon icon={Eye} size="sm" />
                              </IconButton>
                            )}

                            <IconButton
                              aria-label={exam.active ? "Скрыть тест" : "Удалить тест навсегда"}
                              title={exam.active ? "Скрыть" : "Удалить навсегда"}
                              onClick={() => runExamAction(exam.id, exam.active ? "hide" : "delete")}
                              disabled={isBusy}
                            >
                              <Icon icon={Trash2} size="sm" />
                            </IconButton>
                          </>
                        )}

                        <Button
                          size="sm"
                          onClick={() => navigate(trainingRoutes.knowledgeExamRun(currentFolderId!, exam.id))}
                        >
                          Пройти
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {(itemsLoading || itemsError || items.length > 0) && (
      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Карточки</h3>
        {itemsLoading && <LoadingState label="Загрузка карточек…" />}
        {itemsError && <ErrorState message={itemsError} onRetry={loadItems} />}
        {!itemsLoading && !itemsError && items.length > 0 && (
          <KnowledgeItemsGrid
            items={items}
            canManage={canManage}
            actionLoadingId={itemActionLoadingId}
            actionLoadingType={itemActionLoadingType}
            onEdit={openEditItemModal}
            onHide={(id) => runItemAction(id, "hide")}
            onRestore={(id) => runItemAction(id, "restore")}
            onDelete={(id) => runItemAction(id, "delete")}
          />
        )}
      </Card>
      )}

      {isCompletelyEmpty && (
        <EmptyState title="Пока пусто" description="Создайте папку или карточку." />
      )}

      {restaurantId && (
        <TrainingFolderModal
          open={folderModalOpen}
          mode={editingFolder ? "edit" : "create"}
          restaurantId={restaurantId}
          type="KNOWLEDGE"
          parentFolder={editingFolder ? (editingFolder.parentId ? folderMap.get(editingFolder.parentId) ?? null : null) : currentFolder}
          initialFolder={editingFolder}
          onClose={() => { setEditingFolder(null); setFolderModalOpen(false); }}
          onSaved={foldersState.reload}
        />
      )}

      {restaurantId && (
        <ExamEditorModal
          open={examModalOpen}
          restaurantId={restaurantId}
          mode="PRACTICE"
          exam={editingExam}
          knowledgeFolderId={currentFolderId}
          onClose={() => { setEditingExam(null); setExamModalOpen(false); }}
          onSaved={loadPracticeExams}
        />
      )}

      {restaurantId && (
        <KnowledgeItemModal
          open={knowledgeModalOpen}
          mode={knowledgeModalMode}
          item={editingItem ?? undefined}
          restaurantId={restaurantId}
          folderId={currentFolderId}
          onClose={() => setKnowledgeModalOpen(false)}
          onSaved={loadItems}
        />
      )}
    </div>
  );
}
