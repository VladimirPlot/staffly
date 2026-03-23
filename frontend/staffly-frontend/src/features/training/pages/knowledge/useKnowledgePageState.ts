import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPositions, type PositionDto } from "../../../dictionaries/api";
import { mapExamsForUi, mapKnowledgeItemsForUi } from "../../api/mappers";
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
} from "../../api/trainingApi";
import type {
  ExamProgressDto,
  TrainingExamDto,
  TrainingFolderDto,
  TrainingKnowledgeItemDto,
} from "../../api/types";
import { useTrainingFolders } from "../../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../../utils/errors";
import { hasInProgressExamAttempt } from "../../utils/practiceExamStatus";
import { bySortOrderAndName } from "../../utils/sort";
import { trainingRoutes } from "../../utils/trainingRoutes";

type Params = {
  currentFolderId: number | null;
  restaurantId?: number;
  canManage: boolean;
};

type ItemAction = "hide" | "restore" | "delete";
type ExamAction = "hide" | "restore" | "delete";

export function useKnowledgePageState({ currentFolderId, restaurantId, canManage }: Params) {
  const navigate = useNavigate();
  const foldersState = useTrainingFolders({ restaurantId: restaurantId ?? null, type: "KNOWLEDGE", canManage });

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
  const [examProgress, setExamProgress] = useState<ExamProgressDto[]>([]);
  const [inProgressExamIds, setInProgressExamIds] = useState<Set<number>>(new Set());

  const folderMap = useMemo(
    () => new Map(foldersState.folders.map((folder) => [folder.id, folder])),
    [foldersState.folders],
  );
  const currentFolder = currentFolderId == null ? null : folderMap.get(currentFolderId) ?? null;

  useEffect(() => {
    if (!restaurantId || !canManage) return;
    void listPositions(restaurantId, { includeInactive: false })
      .then(setPositions)
      .catch(() => setPositions([]));
  }, [restaurantId, canManage]);

  const positionNameById = useMemo(
    () => new Map(positions.map((position) => [position.id, position.name])),
    [positions],
  );
  const progressByExamId = useMemo(
    () => new Map(examProgress.map((item) => [item.examId, item])),
    [examProgress],
  );
  const visiblePositions = useMemo(() => {
    if (!currentFolder || currentFolder.visibilityPositionIds.length === 0) return positions;
    const allowed = new Set(currentFolder.visibilityPositionIds);
    return positions.filter((position) => allowed.has(position.id));
  }, [currentFolder, positions]);
  const childFolders = useMemo(() => {
    const children = foldersState.folders.filter((folder) => folder.parentId === currentFolderId);
    const filtered = !positionFilter
      ? children
      : children.filter(
          (folder) =>
            folder.visibilityPositionIds.length === 0 ||
            folder.visibilityPositionIds.includes(positionFilter),
        );
    return filtered.sort(bySortOrderAndName);
  }, [currentFolderId, foldersState.folders, positionFilter]);

  const loadItems = useCallback(async () => {
    if (!restaurantId) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await listKnowledgeItems(
        restaurantId,
        currentFolderId ?? undefined,
        canManage ? foldersState.includeInactive : false,
      );
      setItems(mapKnowledgeItemsForUi(response));
    } catch (loadError) {
      setItemsError(getTrainingErrorMessage(loadError, "Не удалось загрузить карточки."));
    } finally {
      setItemsLoading(false);
    }
  }, [canManage, currentFolderId, foldersState.includeInactive, restaurantId]);

  const loadPracticeExams = useCallback(async () => {
    if (!restaurantId || currentFolderId == null) {
      setPracticeExams([]);
      return;
    }
    setExamsLoading(true);
    setExamsError(null);
    try {
      const response = await listKnowledgeExams(
        restaurantId,
        currentFolderId,
        canManage ? foldersState.includeInactive : false,
      );
      setPracticeExams(mapExamsForUi(response));
    } catch (loadError) {
      setExamsError(getTrainingErrorMessage(loadError, "Не удалось загрузить тесты."));
    } finally {
      setExamsLoading(false);
    }
  }, [canManage, currentFolderId, foldersState.includeInactive, restaurantId]);

  const loadExamProgress = useCallback(async () => {
    if (!restaurantId) {
      setExamProgress([]);
      return;
    }

    try {
      setExamProgress(await getExamProgress(restaurantId));
    } catch {
      setExamProgress([]);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadPracticeExams();
  }, [loadPracticeExams]);

  useEffect(() => {
    void loadExamProgress();
  }, [loadExamProgress]);

  const refreshInProgressExamIds = useCallback(() => {
    setInProgressExamIds(
      new Set(practiceExams.filter((exam) => hasInProgressExamAttempt(exam.id)).map((exam) => exam.id)),
    );
  }, [practiceExams]);

  useEffect(() => {
    refreshInProgressExamIds();
  }, [refreshInProgressExamIds]);

  useEffect(() => {
    const handleFocus = () => refreshInProgressExamIds();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshInProgressExamIds();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshInProgressExamIds]);

  const runDelete = async (folderIdToDelete: number) => {
    if (!restaurantId) return;
    const deletingFolder = folderMap.get(folderIdToDelete) ?? null;
    setActionLoadingId(folderIdToDelete);
    setFolderError(null);
    try {
      await deleteFolder(restaurantId, folderIdToDelete);
      await foldersState.reload();
      if (folderIdToDelete === currentFolderId) {
        navigate(
          deletingFolder?.parentId
            ? `${trainingRoutes.knowledge}/${deletingFolder.parentId}`
            : trainingRoutes.knowledge,
        );
      }
    } catch (deleteError) {
      setFolderError(getTrainingErrorMessage(deleteError, "Не удалось удалить папку."));
    } finally {
      setActionLoadingId(null);
    }
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
    } catch (itemError) {
      setItemsError(getTrainingErrorMessage(itemError, "Не удалось выполнить действие с карточкой."));
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
      if (action === "hide") await hideExam(restaurantId, examId);
      else if (action === "restore") await restoreExam(restaurantId, examId);
      else await deleteExam(restaurantId, examId);
      await Promise.all([loadPracticeExams(), loadExamProgress()]);
      refreshInProgressExamIds();
    } catch (examError) {
      setExamsError(getTrainingErrorMessage(examError, "Не удалось выполнить действие с тестом."));
    } finally {
      setExamActionLoadingId(null);
    }
  };

  const showFolderNotFound =
    currentFolderId !== null &&
    !foldersState.loading &&
    !foldersState.error &&
    !currentFolder;

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

  return {
    actionLoadingId,
    canManage,
    childFolders,
    currentFolder,
    editingExam,
    editingFolder,
    editingItem,
    examActionLoadingId,
    examModalOpen,
    examProgress,
    examsError,
    examsLoading,
    folderError,
    folderMap,
    folderModalOpen,
    foldersState,
    inProgressExamIds,
    isCompletelyEmpty,
    itemActionLoadingId,
    itemActionLoadingType,
    items,
    itemsError,
    itemsLoading,
    knowledgeModalMode,
    knowledgeModalOpen,
    loadItems,
    loadPracticeExams,
    positionFilter,
    positionNameById,
    practiceExams,
    progressByExamId,
    restaurantId,
    runDelete,
    runExamAction,
    runItemAction,
    setEditingExam,
    setEditingFolder,
    setEditingItem,
    setExamModalOpen,
    setFolderModalOpen,
    setKnowledgeModalMode,
    setKnowledgeModalOpen,
    setPositionFilter,
    showFolderNotFound,
    visiblePositions,
    openCreateItemModal: () => {
      setEditingItem(null);
      setKnowledgeModalMode("create");
      setKnowledgeModalOpen(true);
    },
    openEditItemModal: (item: TrainingKnowledgeItemDto) => {
      setEditingItem(item);
      setKnowledgeModalMode("edit");
      setKnowledgeModalOpen(true);
    },
    openCreateFolderModal: () => {
      setEditingFolder(null);
      setFolderModalOpen(true);
    },
    openCreateExamModal: () => {
      if (currentFolderId == null) {
        setExamsError("Выберите папку базы знаний, чтобы создать учебный тест.");
        return;
      }
      setEditingExam(null);
      setExamModalOpen(true);
    },
    navigate,
  };
}
