import { useCallback, useEffect, useRef, useState } from "react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
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
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!createMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (createMenuRef.current?.contains(event.target as Node)) return;
      setCreateMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [createMenuOpen]);

  const openCreateModal = (target: Exclude<CreateTarget, null>) => {
    setCreateModalTarget(target);
    setCreateMenuOpen(false);
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
      const createdFolder = await createFolder(restaurantId, {
        type: "KNOWLEDGE",
        parentId: selectedFolder?.id ?? null,
        name: trimmedName,
        description: trimmedDescription || null,
      });

      setCreateModalTarget(null);
      await foldersState.reload();
      setSelectedFolder(createdFolder);
    } catch (e) {
      setCreateFolderError(getTrainingErrorMessage(e, "Не удалось создать папку."));
    } finally {
      setCreateFolderSubmitting(false);
    }
  };

  const runItemAction = async (itemId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setItemActionLoadingId(itemId);
    try {
      if (action === "hide") await hideKnowledgeItem(restaurantId, itemId);
      if (action === "restore") await restoreKnowledgeItem(restaurantId, itemId);
      if (action === "delete") await deleteKnowledgeItem(restaurantId, itemId);
      await loadItems();
    } catch (e) {
      setItemsError(getTrainingErrorMessage(e, "Не удалось выполнить действие с материалом."));
    } finally {
      setItemActionLoadingId(null);
    }
  };

  const isCreateFolderModal = createModalTarget === "folder";
  const createFolderNameTrimmed = createFolderName.trim();

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

            <div ref={createMenuRef} className="relative sm:hidden">
              <Button
                variant="outline"
                onClick={() => setCreateMenuOpen((prev) => !prev)}
                aria-expanded={createMenuOpen}
                aria-haspopup="menu"
              >
                Создать
              </Button>

              {createMenuOpen && (
                <div className="border-subtle bg-surface absolute right-0 z-20 mt-2 w-56 rounded-2xl border p-1 shadow-[var(--staffly-shadow)]">
                  <button
                    type="button"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => openCreateModal("folder")}
                  >
                    Папку
                  </button>
                  <button
                    type="button"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => openCreateModal("card")}
                  >
                    Карточку
                  </button>
                  <button
                    type="button"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => openCreateModal("test")}
                  >
                    Тест
                  </button>
                </div>
              )}
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

      {foldersState.folders.length > 0 && (
        <FolderList
          folders={foldersState.folders}
          canManage={canManage}
          actionLoadingId={foldersState.actionLoadingId}
          onSelect={setSelectedFolder}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
        />
      )}

      {selectedFolder && (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">Материалы папки: {selectedFolder.name}</h3>

          {itemsLoading && <LoadingState label="Загрузка материалов…" />}
          {itemsError && <ErrorState message={itemsError} onRetry={loadItems} />}

          {!itemsLoading && !itemsError && items.length === 0 && (
            <EmptyState
              title="Материалов пока нет"
              description="Создайте карточки знаний для этой папки."
            />
          )}

          {!itemsLoading && !itemsError && items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="border-subtle bg-app rounded-2xl border p-3">
                  <div className="font-medium">{item.title}</div>

                  {item.description && (
                    <div className="text-muted mt-1 line-clamp-3 text-sm">{item.description}</div>
                  )}
                  {!item.active && <div className="mt-1 text-xs text-amber-600">Скрыт</div>}

                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={itemActionLoadingId === item.id}
                          onClick={() => runItemAction(item.id, "hide")}
                        >
                          Скрыть
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={itemActionLoadingId === item.id}
                            onClick={() => runItemAction(item.id, "restore")}
                          >
                            Восстановить
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={itemActionLoadingId === item.id}
                            onClick={() => runItemAction(item.id, "delete")}
                          >
                            Удалить
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={createModalTarget !== null}
        title={isCreateFolderModal ? "Создать папку" : "В разработке"}
        description={
          !isCreateFolderModal && createModalTarget ? createModalContent[createModalTarget] : undefined
        }
        onClose={closeCreateModal}
        footer={
          isCreateFolderModal ? (
            <>
              <Button variant="outline" onClick={closeCreateModal} disabled={createFolderSubmitting}>
                Отмена
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!createFolderNameTrimmed}
                isLoading={createFolderSubmitting}
              >
                Создать
              </Button>
            </>
          ) : (
            <Button onClick={closeCreateModal}>Закрыть</Button>
          )
        }
      >
        {isCreateFolderModal && (
          <div className="space-y-4">
            <Input
              label="Название"
              value={createFolderName}
              onChange={(event) => setCreateFolderName(event.target.value)}
              autoFocus
              required
            />

            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-muted">Описание (опционально)</span>
              <textarea
                className="border-subtle w-full max-w-full rounded-2xl border bg-surface p-3 text-[16px] text-default outline-none transition focus:ring-2 focus:ring-default dark:[color-scheme:dark]"
                value={createFolderDescription}
                onChange={(event) => setCreateFolderDescription(event.target.value)}
                rows={4}
              />
            </label>

            <div className="text-sm text-muted">
              {selectedFolder
                ? `Папка будет создана внутри: ${selectedFolder.name}`
                : "Папка будет создана в корне базы знаний"}
            </div>

            {createFolderError && (
              <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createFolderError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
