import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Card from "../../../shared/ui/Card";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import KnowledgeHeader from "../components/KnowledgeHeader";
import KnowledgeItemModal from "../components/KnowledgeItemModal";
import KnowledgeItemsGrid from "../components/KnowledgeItemsGrid";
import LoadingState from "../components/LoadingState";
import TrainingFolderModal from "../components/TrainingFolderModal";
import { mapKnowledgeItemsForUi } from "../api/mappers";
import { deleteFolder, deleteKnowledgeItem, hideKnowledgeItem, listKnowledgeItems, restoreKnowledgeItem } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingKnowledgeItemDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { useExams } from "../hooks/useExams";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

type Props = {
  currentFolderId: number | null;
};

type ItemAction = "hide" | "restore" | "delete";

export default function KnowledgePageBase({ currentFolderId }: Props) {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });
  const practiceExamsState = useExams({ restaurantId, canManage, certificationOnly: false });

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

  const folderMap = useMemo(() => new Map(foldersState.folders.map((folder) => [folder.id, folder])), [foldersState.folders]);
  const currentFolder = currentFolderId == null ? null : folderMap.get(currentFolderId) ?? null;

  useEffect(() => {
    if (!restaurantId || !canManage) return;
    void listPositions(restaurantId, { includeInactive: false }).then(setPositions).catch(() => setPositions([]));
  }, [restaurantId, canManage]);

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

  const showFolderNotFound = currentFolderId !== null && !foldersState.loading && !foldersState.error && !currentFolder;

  if (showFolderNotFound) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Breadcrumbs items={breadcrumbItems} />
        <ErrorState message="Папка не найдена или недоступна" actionLabel="К списку" onRetry={() => navigate(trainingRoutes.knowledge)} />
      </div>
    );
  }

  const isCompletelyEmpty = !childFolders.length && !items.length && !foldersState.loading && !foldersState.error && !itemsLoading && !itemsError;

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
        onCreateTest={() => navigate(trainingRoutes.exams)}
      />

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {folderError && <ErrorState message={folderError} onRetry={foldersState.reload} />}

      {childFolders.length > 0 && (
        <FolderList
          folders={childFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          onOpen={(id) => navigate(`${trainingRoutes.knowledge}/${id}`)}
          onEdit={(folder) => { setEditingFolder(folder); setFolderModalOpen(true); }}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Практические тесты</h3>
        {practiceExamsState.loading && <LoadingState label="Загрузка тестов…" />}
        {!practiceExamsState.loading && practiceExamsState.exams.length === 0 && (
          <EmptyState title="Практических тестов пока нет" description="Тесты режима PRACTICE появятся здесь." />
        )}
        {!practiceExamsState.loading && practiceExamsState.exams.length > 0 && (
          <div className="space-y-2">
            {practiceExamsState.exams.map((exam) => (
              <button key={exam.id} type="button" className="border-subtle bg-app w-full rounded-2xl border p-3 text-left" onClick={() => navigate(trainingRoutes.examRun(exam.id))}>
                <div className="font-medium">{exam.title}</div>
                {exam.description && <div className="text-sm text-muted">{exam.description}</div>}
              </button>
            ))}
          </div>
        )}
      </Card>

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
