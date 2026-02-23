import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import { createFolder, deleteFolder, updateFolder } from "../api/trainingApi";
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

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

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

  const rootFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId === null).sort(bySortOrderAndName),
    [foldersState.folders]
  );

  const openCreateModal = (target: Exclude<CreateTarget, null>) => {
    setCreateModalTarget(target);
    setCreateMenuOpen(false);
    setFolderName("");
    setFolderDescription("");
    setFolderError(null);
    setEditingFolder(null);
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
          parentId: null,
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

  const runDelete = async (folderId: number) => {
    if (!restaurantId) return;
    setActionLoadingId(folderId);
    try {
      await deleteFolder(restaurantId, folderId);
      await foldersState.reload();
    } catch (error) {
      setFolderError(getTrainingErrorMessage(error, "Не удалось удалить папку."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const isFolderModal = createModalTarget === "folder";
  const modalTitle = editingFolder ? "Редактировать папку" : "Создать папку";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs
        items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "База знаний" }]}
      />
      <h2 className="text-2xl font-semibold">База знаний</h2>

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
        </div>
      )}

      {foldersState.loading && <LoadingState label="Загрузка папок базы знаний…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {!foldersState.loading && !foldersState.error && rootFolders.length === 0 && (
        <EmptyState title="Папки не найдены" description="Добавьте первую папку базы знаний." />
      )}

      {rootFolders.length > 0 && (
        <FolderList
          folders={rootFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          onOpen={(folderId) => navigate(`${trainingRoutes.knowledge}/${folderId}`)}
          onEdit={openEditModal}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

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
