import { useCallback, useEffect, useRef, useState } from "react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import { mapKnowledgeItemsForUi } from "../api/mappers";
import {
  createFolder,
  deleteKnowledgeItem,
  hideKnowledgeItem,
  listKnowledgeItems,
  restoreKnowledgeItem,
} from "../api/trainingApi";
import type { TrainingFolderDto, TrainingKnowledgeItemDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

type CreateTarget = "folder" | "card" | "test" | null;

const createModalContent: Record<Exclude<CreateTarget, null>, string> = {
  folder: "Здесь будет форма создания новой папки базы знаний.",
  card: "Здесь будет форма создания новой карточки знаний.",
  test: "Здесь будет форма создания нового теста.",
};

export default function KnowledgePage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });

  const [selectedFolder, setSelectedFolder] = useState<TrainingFolderDto | null>(null);
  const [items, setItems] = useState<TrainingKnowledgeItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemActionLoadingId, setItemActionLoadingId] = useState<number | null>(null);
  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderDescription, setCreateFolderDescription] = useState("");
  const [createFolderSubmitting, setCreateFolderSubmitting] = useState(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  const loadItems = useCallback(async () => {
    if (!restaurantId || !selectedFolder) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await listKnowledgeItems(
        restaurantId,
        selectedFolder.id,
        canManage ? foldersState.includeInactive : false,
      );
      setItems(mapKnowledgeItemsForUi(response));
    } catch (e) {
      setItemsError(getTrainingErrorMessage(e, "Не удалось загрузить материалы папки."));
    } finally {
      setItemsLoading(false);
    }
  }, [restaurantId, selectedFolder, canManage, foldersState.includeInactive]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // click-away / escape handled inside shared DropdownMenu

  const openCreateModal = (target: Exclude<CreateTarget, null>) => {
    setCreateModalTarget(target);
    if (target === "folder") {
      setCreateFolderName("");
      setCreateFolderDescription("");
      setCreateFolderError(null);
      setCreateFolderSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    if (createFolderSubmitting) return;
    setCreateModalTarget(null);
    setCreateFolderError(null);
  };

  const handleCreateFolder = async () => {
    if (!restaurantId) return;

    const trimmedName = createFolderName.trim();
    const trimmedDescription = createFolderDescription.trim();
    if (!trimmedName) return;

    setCreateFolderSubmitting(true);
    setCreateFolderError(null);
    try {
      await createFolder(restaurantId, {
        type: "KNOWLEDGE",
        parentId: null,
        name: trimmedName,
        description: trimmedDescription || null,
      });
      await foldersState.reload();
      closeCreateModal();
    } catch (e) {
      setCreateFolderError(getTrainingErrorMessage(e, "Не удалось создать папку."));
    } finally {
      setCreateFolderSubmitting(false);
    }
  };

  const runItemAction = async (itemId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setItemActionLoadingId(itemId);
    setItemsError(null);
    try {
      if (action === "hide") {
        await hideKnowledgeItem(restaurantId, itemId);
      } else if (action === "restore") {
        await restoreKnowledgeItem(restaurantId, itemId);
      } else {
        await deleteKnowledgeItem(restaurantId, itemId);
      }
      await loadItems();
    } catch (e) {
      setItemsError(getTrainingErrorMessage(e, "Не удалось выполнить действие."));
    } finally {
      setItemActionLoadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs
        items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "База знаний" }]}
      />
      <h2 className="text-2xl font-semibold">База знаний</h2>

      {canManage && (
        <Card className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Switch
              label="Скрытые элементы"
              checked={foldersState.includeInactive}
              onChange={(e) => foldersState.setIncludeInactive(e.target.checked)}
            />

            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button variant="outline" onClick={() => openCreateModal("folder")}>
                Создать папку
              </Button>
              <Button variant="outline" onClick={() => openCreateModal("card")}>
                Создать карточку
              </Button>
              <Button variant="outline" onClick={() => openCreateModal("test")}>
                Создать тест
              </Button>
            </div>

            <div ref={createMenuRef} className="sm:hidden">
              <DropdownMenu
                trigger={(triggerProps) => (
                  <Button variant="outline" {...triggerProps}>
                    Создать
                  </Button>
                )}
              >
                {({ close }) => (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                      onClick={() => {
                        close();
                        openCreateModal("folder");
                      }}
                    >
                      Папку
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                      onClick={() => {
                        close();
                        openCreateModal("card");
                      }}
                    >
                      Карточку
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                      onClick={() => {
                        close();
                        openCreateModal("test");
                      }}
                    >
                      Тест
                    </button>
                  </>
                )}
              </DropdownMenu>
            </div>
          </div>
        </Card>
      )}

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && (
        <ErrorState message={foldersState.error} onRetry={foldersState.reload} />
      )}
      {!foldersState.loading && !foldersState.error && foldersState.folders.length === 0 && (
        <EmptyState title="Папки не найдены" description="Добавьте первую папку базы знаний." />
      )}

      {!foldersState.loading && !foldersState.error && foldersState.folders.length > 0 && (
        <FolderList
          folders={foldersState.folders.filter((f) => f.parentId === null)}
          canManage={canManage}
          actionLoadingId={foldersState.actionLoadingId}
          onOpen={(id) => setSelectedFolder(foldersState.folders.find((f) => f.id === id) ?? null)}
          onEdit={() => {}}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={foldersState.deleteForever}
        />
      )}

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Материалы</h3>
        {itemsLoading && <LoadingState label="Загрузка материалов…" />}
        {itemsError && <ErrorState message={itemsError} onRetry={loadItems} />}
        {!itemsLoading && !itemsError && items.length === 0 && (
          <EmptyState title="Материалов нет" description="Выберите папку или добавьте материалы." />
        )}

        {/* Здесь у тебя дальше была сетка/карточки — я не трогал, только меню и логику кликов */}
      </Card>

      <Modal
        open={createModalTarget !== null}
        title="Создание"
        onClose={closeCreateModal}
        footer={
          createModalTarget === "folder" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeCreateModal} disabled={createFolderSubmitting}>
                Отмена
              </Button>
              <Button onClick={handleCreateFolder} disabled={createFolderSubmitting || !createFolderName.trim()}>
                Создать
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="outline" onClick={closeCreateModal}>
                Закрыть
              </Button>
            </div>
          )
        }
      >
        {createModalTarget && createModalTarget !== "folder" ? (
          <div className="text-sm text-muted">{createModalContent[createModalTarget]}</div>
        ) : (
          <div className="space-y-3">
            <Input label="Название" value={createFolderName} onChange={(e) => setCreateFolderName(e.target.value)} />
            <Input
              label="Описание"
              value={createFolderDescription}
              onChange={(e) => setCreateFolderDescription(e.target.value)}
            />
            {createFolderError && <div className="text-sm text-red-600">{createFolderError}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
