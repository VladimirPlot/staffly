import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import KnowledgeItemsGrid from "../components/KnowledgeItemsGrid";
import KnowledgeItemModal from "../components/KnowledgeItemModal";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import TrainingFolderModal from "../components/TrainingFolderModal";
import { mapKnowledgeItemsForUi } from "../api/mappers";
import {
  deleteFolder,
  deleteKnowledgeItem,
  hideKnowledgeItem,
  listKnowledgeItems,
  restoreKnowledgeItem,
} from "../api/trainingApi";
import type { TrainingFolderDto, TrainingKnowledgeItemDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

type CreateTarget = "folder" | "card" | null;
type ItemAction = "hide" | "restore" | "delete";

export default function KnowledgeFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });

  const [items, setItems] = useState<TrainingKnowledgeItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [knowledgeModalMode, setKnowledgeModalMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<TrainingKnowledgeItemDto | null>(null);
  const [itemActionLoadingId, setItemActionLoadingId] = useState<number | null>(null);
  const [itemActionLoadingType, setItemActionLoadingType] = useState<ItemAction | null>(null);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  const folderMap = useMemo(() => new Map(foldersState.folders.map((folder) => [folder.id, folder])), [foldersState.folders]);
  const currentFolder = folderMap.get(currentFolderId) ?? null;

  useEffect(() => {
    if (!restaurantId || !canManage) return;
    void listPositions(restaurantId, { includeInactive: false }).then(setPositions).catch(() => setPositions([]));
  }, [restaurantId, canManage]);

  const filterPositions = useMemo(() => {
    if (!currentFolder || currentFolder.visibilityPositionIds.length === 0) {
      return positions;
    }
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
    if (!restaurantId || !currentFolder) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await listKnowledgeItems(restaurantId, currentFolder.id, canManage ? foldersState.includeInactive : false);
      setItems(mapKnowledgeItemsForUi(response));
    } catch (error) {
      setItemsError(getTrainingErrorMessage(error, "Не удалось загрузить материалы папки."));
    } finally {
      setItemsLoading(false);
    }
  }, [restaurantId, currentFolder, canManage, foldersState.includeInactive]);

  useEffect(() => {
    if (!currentFolder) return;
    void loadItems();
  }, [currentFolder, loadItems]);

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; to?: string }[] = [
      { label: "Тренинг", to: trainingRoutes.landing },
      { label: "База знаний", to: trainingRoutes.knowledge },
    ];
    if (!currentFolder) return items;
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
      items.push({ label: folder.name, to: isLast ? undefined : `${trainingRoutes.knowledge}/${folder.id}` });
    });
    return items;
  }, [currentFolder, folderMap]);

  const runDelete = async (folderIdToDelete: number) => {
    if (!restaurantId) return;
    const deletingFolder = folderMap.get(folderIdToDelete) ?? null;
    setActionLoadingId(folderIdToDelete);
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

  if (Number.isNaN(currentFolderId)) {
    return <div className="mx-auto max-w-5xl space-y-4"><ErrorState message="Папка не найдена" actionLabel="К списку" onRetry={() => navigate(trainingRoutes.knowledge)} /></div>;
  }

  if (!foldersState.loading && !foldersState.error && !currentFolder) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Breadcrumbs items={breadcrumbItems} />
        <ErrorState message="Папка не найдена или недоступна" actionLabel="К списку" onRetry={() => navigate(trainingRoutes.knowledge)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{currentFolder?.name ?? "Папка"}</h2>

      {canManage && (
        <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Switch label="Скрытые элементы" checked={foldersState.includeInactive} onChange={(event) => foldersState.setIncludeInactive(event.target.checked)} />
            <DropdownMenu
              trigger={(triggerProps) => (
                <Button variant="outline" {...triggerProps}>
                  Фильтр по должности: {filterPositions.find((p) => p.id === positionFilter)?.name ?? "Все должности"}
                </Button>
              )}
              menuClassName="w-72"
            >
              {({ close }) => (
                <>
                  <button type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { setPositionFilter(null); close(); }}>Все должности</button>
                  {filterPositions.map((position) => (
                    <button key={position.id} type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { setPositionFilter(position.id); close(); }}>{position.name}</button>
                  ))}
                </>
              )}
            </DropdownMenu>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button variant="outline" onClick={() => setCreateModalTarget("folder")}>Создать папку</Button>
              <Button variant="outline" onClick={openCreateItemModal}>Создать карточку</Button>
            </div>
            <div ref={createMenuRef} className="sm:hidden">
              <DropdownMenu trigger={(triggerProps) => <Button variant="outline" {...triggerProps}>Создать</Button>}>
                {({ close }) => (
                  <>
                    <button type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { close(); setCreateModalTarget("folder"); }}>Папку</button>
                    <button type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { close(); openCreateItemModal(); }}>Карточку</button>
                  </>
                )}
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {folderError && <ErrorState message={folderError} onRetry={foldersState.reload} />}

      {!foldersState.loading && !foldersState.error && childFolders.length > 0 && (
        <FolderList
          folders={childFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          onOpen={(id) => navigate(`${trainingRoutes.knowledge}/${id}`)}
          onEdit={(folder) => { setEditingFolder(folder); setCreateModalTarget("folder"); }}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      {!foldersState.loading && !foldersState.error && childFolders.length === 0 && <EmptyState title="Подпапок пока нет" description="Создайте подпапку для структуры базы знаний." />}

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Карточки</h3>
        {itemsLoading && <LoadingState label="Загрузка карточек…" />}
        {itemsError && <ErrorState message={itemsError} onRetry={loadItems} />}
        {!itemsLoading && !itemsError && items.length === 0 && <EmptyState title="Карточек пока нет" description="Создайте первую карточку для этой папки." />}
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

      {restaurantId && currentFolder && (
        <TrainingFolderModal
          open={createModalTarget === "folder"}
          mode={editingFolder ? "edit" : "create"}
          restaurantId={restaurantId}
          type="KNOWLEDGE"
          parentFolder={editingFolder ? (editingFolder.parentId ? folderMap.get(editingFolder.parentId) ?? null : null) : currentFolder}
          initialFolder={editingFolder}
          onClose={() => { setCreateModalTarget(null); setEditingFolder(null); }}
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
