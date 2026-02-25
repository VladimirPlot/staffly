import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import TrainingFolderModal from "../components/TrainingFolderModal";
import { deleteFolder } from "../api/trainingApi";
import type { TrainingFolderDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { bySortOrderAndName } from "../utils/sort";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

type CreateTarget = "folder" | "card" | "test" | null;

const createModalContent: Record<Exclude<CreateTarget, null>, string> = {
  folder: "",
  card: "Здесь будет форма создания новой карточки знаний.",
  test: "Здесь будет форма создания нового теста.",
};

export default function KnowledgeRootPage() {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });

  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!restaurantId || !canManage) return;
    void listPositions(restaurantId, { includeInactive: false }).then(setPositions).catch(() => setPositions([]));
  }, [restaurantId, canManage]);

  const rootFolders = useMemo(() => {
    const onlyRoot = foldersState.folders.filter((folder) => folder.parentId === null);
    if (!positionFilter) {
      return onlyRoot.sort(bySortOrderAndName);
    }
    return onlyRoot
      .filter((folder) =>
        folder.visibilityPositionIds.length === 0 || folder.visibilityPositionIds.includes(positionFilter)
      )
      .sort(bySortOrderAndName);
  }, [foldersState.folders, positionFilter]);

  const openCreateModal = (target: Exclude<CreateTarget, null>) => {
    setCreateModalTarget(target);
    setFolderError(null);
    setEditingFolder(null);
  };

  const runDelete = async (folderId: number) => {
    if (!restaurantId) return;
    setActionLoadingId(folderId);
    setFolderError(null);
    try {
      await deleteFolder(restaurantId, folderId);
      await foldersState.reload();
    } catch (error) {
      setFolderError(getTrainingErrorMessage(error, "Не удалось удалить папку."));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "База знаний" }]} />
      <h2 className="text-2xl font-semibold">База знаний</h2>

      {canManage && (
        <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Switch
              label="Скрытые элементы"
              checked={foldersState.includeInactive}
              onChange={(event) => foldersState.setIncludeInactive(event.target.checked)}
            />

            <DropdownMenu
              trigger={(triggerProps) => (
                <Button variant="outline" {...triggerProps}>
                  Фильтр по должности: {positions.find((p) => p.id === positionFilter)?.name ?? "Все должности"}
                </Button>
              )}
              menuClassName="w-72"
            >
              {({ close }) => (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => {
                      setPositionFilter(null);
                      close();
                    }}
                  >
                    Все должности
                  </button>
                  {positions.map((position) => (
                    <button
                      key={position.id}
                      type="button"
                      role="menuitem"
                      className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                      onClick={() => {
                        setPositionFilter(position.id);
                        close();
                      }}
                    >
                      {position.name}
                    </button>
                  ))}
                </>
              )}
            </DropdownMenu>

            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button variant="outline" onClick={() => openCreateModal("folder")}>Создать папку</Button>
              <Button variant="outline" onClick={() => openCreateModal("card")}>Создать карточку</Button>
              <Button variant="outline" onClick={() => openCreateModal("test")}>Создать тест</Button>
            </div>

            <div ref={createMenuRef} className="sm:hidden">
              <DropdownMenu
                trigger={(triggerProps) => (
                  <Button variant="outline" {...triggerProps}>Создать</Button>
                )}
              >
                {({ close }) => (
                  <>
                    <button type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { close(); openCreateModal("folder"); }}>Папку</button>
                    <button type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { close(); openCreateModal("card"); }}>Карточку</button>
                    <button type="button" role="menuitem" className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm" onClick={() => { close(); openCreateModal("test"); }}>Тест</button>
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
      {!foldersState.loading && !foldersState.error && rootFolders.length === 0 && (
        <EmptyState title="Папки не найдены" description="Добавьте первую папку базы знаний." />
      )}

      {rootFolders.length > 0 && (
        <FolderList
          folders={rootFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          onOpen={(folderId) => navigate(`${trainingRoutes.knowledge}/${folderId}`)}
          onEdit={(folder) => {
            setEditingFolder(folder);
            setCreateModalTarget("folder");
          }}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      {createModalTarget && createModalTarget !== "folder" && (
        <ErrorState message={createModalContent[createModalTarget]} />
      )}

      {restaurantId && (
        <TrainingFolderModal
          open={createModalTarget === "folder"}
          mode={editingFolder ? "edit" : "create"}
          restaurantId={restaurantId}
          type="KNOWLEDGE"
          initialFolder={editingFolder}
          parentFolder={null}
          onClose={() => {
            setCreateModalTarget(null);
            setEditingFolder(null);
          }}
          onSaved={foldersState.reload}
        />
      )}
    </div>
  );
}
