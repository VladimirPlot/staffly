import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
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

  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  // click-away / escape handled inside shared DropdownMenu

  const rootFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId === null).sort(bySortOrderAndName),
    [foldersState.folders]
  );

  const openCreateModal = (target: Exclude<CreateTarget, null>) => {
    setCreateModalTarget(target);
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
          onEdit={openEditModal}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      <Modal
        open={createModalTarget !== null}
        title={editingFolder ? "Редактировать папку" : "Создать"}
        onClose={closeFolderModal}
        footer={
          createModalTarget === "folder" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeFolderModal} disabled={folderSubmitting}>
                Отмена
              </Button>
              <Button onClick={handleSaveFolder} disabled={folderSubmitting || !folderName.trim()}>
                {editingFolder ? "Сохранить" : "Создать"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="outline" onClick={closeFolderModal}>
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
            <Input label="Название" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
            <Input
              label="Описание"
              value={folderDescription}
              onChange={(event) => setFolderDescription(event.target.value)}
            />
            {folderError && <div className="text-sm text-red-600">{folderError}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
