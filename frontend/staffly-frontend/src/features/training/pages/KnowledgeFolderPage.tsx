import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { createFolder, deleteFolder, listKnowledgeItems, updateFolder } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingKnowledgeItemDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

type CreateTarget = "folder" | "card" | "test" | null;

const createModalContent: Record<Exclude<CreateTarget, null>, string> = {
  folder: "",
  card: "Здесь будет форма создания новой карточки знаний.",
  test: "Здесь будет форма создания нового теста.",
};

export default function KnowledgeFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "KNOWLEDGE", canManage });

  const [items, setItems] = useState<TrainingKnowledgeItemDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  const folderMap = useMemo(
    () => new Map(foldersState.folders.map((folder) => [folder.id, folder])),
    [foldersState.folders]
  );
  const currentFolder = folderMap.get(currentFolderId) ?? null;

  const childFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId === currentFolderId).sort(bySortOrderAndName),
    [foldersState.folders, currentFolderId]
  );

  const loadItems = useCallback(async () => {
    if (!restaurantId || !currentFolder) return;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const response = await listKnowledgeItems(
        restaurantId,
        currentFolder.id,
        canManage ? foldersState.includeInactive : false
      );
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

  useEffect(() => {
    if (!createMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (createMenuRef.current?.contains(event.target as Node)) return;
      setCreateMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreateMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [createMenuOpen]);

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
      items.push({
        label: folder.name,
        to: isLast ? undefined : `${trainingRoutes.knowledge}/${folder.id}`,
      });
    });

    return items;
  }, [currentFolder, folderMap]);

  const openCreateModal = (target: Exclude<CreateTarget, null>) => {
    setCreateModalTarget(target);
    setCreateMenuOpen(false);
    setEditingFolder(null);
    setFolderName("");
    setFolderDescription("");
    setFolderError(null);
  };

  const openEditModal = (folder: TrainingFolderDto) => {
    setEditingFolder(folder);
    setCreateModalTarget("folder");
    setFolderName(folder.name);
    setFolderDescription(folder.description ?? "");
    setFolderError(null);
  };

  const closeFolderModal = () => {
    if (folderSubmitting) return;
    setCreateModalTarget(null);
    setEditingFolder(null);
    setFolderError(null);
  };

  const handleSaveFolder = async () => {
    if (!restaurantId) return;
    const trimmedName = folderName.trim();
    const trimmedDescription = folderDescription.trim();
    if (!trimmedName) return;

    setFolderSubmitting(true);
    setFolderError(null);
    try {
      if (editingFolder) {
        await updateFolder(restaurantId, editingFolder.id, {
          name: trimmedName,
          description: trimmedDescription || null,
        });
        await foldersState.reload();
      } else {
        const created = await createFolder(restaurantId, {
          type: "KNOWLEDGE",
          parentId: currentFolderId,
          name: trimmedName,
          description: trimmedDescription || null,
        });
        await foldersState.reload();
        navigate(`${trainingRoutes.knowledge}/${created.id}`);
      }
      closeFolderModal();
    } catch (error) {
      setFolderError(getTrainingErrorMessage(error, "Не удалось сохранить папку."));
    } finally {
      setFolderSubmitting(false);
    }
  };

  const runDelete = async (folderIdToDelete: number) => {
    if (!restaurantId) return;
    const deletingFolder = folderMap.get(folderIdToDelete) ?? null;
    setActionLoadingId(folderIdToDelete);
    try {
      await deleteFolder(restaurantId, folderIdToDelete);
      await foldersState.reload();
      if (folderIdToDelete === currentFolderId) {
        if (deletingFolder?.parentId) {
          navigate(`${trainingRoutes.knowledge}/${deletingFolder.parentId}`);
        } else {
          navigate(trainingRoutes.knowledge);
        }
      }
    } catch (error) {
      setFolderError(getTrainingErrorMessage(error, "Не удалось удалить папку."));
    } finally {
      setActionLoadingId(null);
    }
  };

  if (Number.isNaN(currentFolderId)) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <ErrorState
          message="Папка не найдена"
          actionLabel="К списку"
          onRetry={() => navigate(trainingRoutes.knowledge)}
        />
      </div>
    );
  }

  if (!foldersState.loading && !foldersState.error && !currentFolder) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Breadcrumbs items={breadcrumbItems} />
        <ErrorState
          message="Папка не найдена или недоступна"
          actionLabel="К списку"
          onRetry={() => navigate(trainingRoutes.knowledge)}
        />
      </div>
    );
  }

  const isFolderModal = createModalTarget === "folder";
  const modalTitle = editingFolder ? "Редактировать папку" : "Создать папку";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{currentFolder?.name ?? "Папка"}</h2>

      {canManage && (
        <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Switch
              label="Скрытые элементы"
              checked={foldersState.includeInactive}
              onChange={(event) => foldersState.setIncludeInactive(event.target.checked)}
            />

            <div className="hidden flex-wrap gap-2 sm:flex">
              <Button variant="outline" onClick={() => openCreateModal("folder")}>
                Создать папку
              </Button>
              <Button variant="outline" onClick={() => openCreateModal("card")}>Создать карточку</Button>
              <Button variant="outline" onClick={() => openCreateModal("test")}>Создать тест</Button>
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
        </div>
      )}

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}

      {!foldersState.loading && !foldersState.error && childFolders.length > 0 && (
        <FolderList
          folders={childFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          onOpen={(id) => navigate(`${trainingRoutes.knowledge}/${id}`)}
          onEdit={openEditModal}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      {!foldersState.loading && !foldersState.error && childFolders.length === 0 && (
        <EmptyState title="Подпапок пока нет" description="Создайте подпапку для структуры базы знаний." />
      )}

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Материалы</h3>
        {itemsLoading && <LoadingState label="Загрузка материалов…" />}
        {itemsError && <ErrorState message={itemsError} onRetry={loadItems} />}

        {!itemsLoading && !itemsError && items.length === 0 && (
          <EmptyState title="Материалов пока нет" description="Создайте карточки знаний для этой папки." />
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
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={createModalTarget !== null}
        title={isFolderModal ? modalTitle : "В разработке"}
        description={!isFolderModal && createModalTarget ? createModalContent[createModalTarget] : undefined}
        onClose={closeFolderModal}
        footer={
          isFolderModal ? (
            <>
              <Button variant="outline" onClick={closeFolderModal} disabled={folderSubmitting}>
                Отмена
              </Button>
              <Button onClick={handleSaveFolder} disabled={!folderName.trim()} isLoading={folderSubmitting}>
                Сохранить
              </Button>
            </>
          ) : (
            <Button onClick={closeFolderModal}>Закрыть</Button>
          )
        }
      >
        {isFolderModal && (
          <div className="space-y-4">
            <Input
              label="Название"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              autoFocus
              required
            />
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-muted">Описание (опционально)</span>
              <textarea
                className="border-subtle w-full max-w-full rounded-2xl border bg-surface p-3 text-[16px] text-default outline-none transition focus:ring-2 focus:ring-default dark:[color-scheme:dark]"
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                rows={4}
              />
            </label>
            {folderError && (
              <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {folderError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
