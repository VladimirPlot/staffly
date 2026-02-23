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
import { mapQuestionsForUi } from "../api/mappers";
import { createFolder, deleteFolder, listQuestions, updateFolder } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingQuestionDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

type CreateTarget = "folder" | "question" | "test" | null;

const createModalContent: Record<Exclude<CreateTarget, null>, string> = {
  folder: "",
  question: "Здесь будет форма создания нового вопроса.",
  test: "Здесь будет форма создания нового теста.",
};

export default function QuestionBankFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "QUESTION_BANK", canManage });

  const [questions, setQuestions] = useState<TrainingQuestionDto[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
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

  const loadQuestions = useCallback(async () => {
    if (!restaurantId || !currentFolder) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const response = await listQuestions(
        restaurantId,
        currentFolder.id,
        canManage ? foldersState.includeInactive : false
      );
      setQuestions(mapQuestionsForUi(response));
    } catch (error) {
      setQuestionsError(getTrainingErrorMessage(error, "Не удалось загрузить вопросы папки."));
    } finally {
      setQuestionsLoading(false);
    }
  }, [restaurantId, currentFolder, canManage, foldersState.includeInactive]);

  useEffect(() => {
    if (!currentFolder) return;
    void loadQuestions();
  }, [currentFolder, loadQuestions]);

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
      { label: "Банк вопросов", to: trainingRoutes.questionBank },
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
        to: isLast ? undefined : trainingRoutes.questionBankFolder(folder.id),
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
    if (!restaurantId || !currentFolder) return;
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
          type: "QUESTION_BANK",
          parentId: currentFolderId,
          name: trimmedName,
          description: trimmedDescription || null,
        });
        await foldersState.reload();
        navigate(trainingRoutes.questionBankFolder(created.id));
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
          navigate(trainingRoutes.questionBankFolder(deletingFolder.parentId));
        } else {
          navigate(trainingRoutes.questionBank);
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
          onRetry={() => navigate(trainingRoutes.questionBank)}
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
          onRetry={() => navigate(trainingRoutes.questionBank)}
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
              <Button variant="outline" onClick={() => openCreateModal("folder")}>Создать папку</Button>
              <Button variant="outline" onClick={() => openCreateModal("question")}>
                Создать вопрос
              </Button>
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
                    onClick={() => openCreateModal("question")}
                  >
                    Вопрос
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

      {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}

      {!foldersState.loading && !foldersState.error && childFolders.length > 0 && (
        <FolderList
          folders={childFolders}
          canManage={canManage}
          actionLoadingId={actionLoadingId ?? foldersState.actionLoadingId}
          onOpen={(id) => navigate(trainingRoutes.questionBankFolder(id))}
          onEdit={openEditModal}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={runDelete}
        />
      )}

      {!foldersState.loading && !foldersState.error && childFolders.length === 0 && (
        <EmptyState title="Подпапок пока нет" description="Создайте подпапку для структуры банка вопросов." />
      )}

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Вопросы</h3>
        {questionsLoading && <LoadingState label="Загрузка вопросов…" />}
        {questionsError && <ErrorState message={questionsError} onRetry={loadQuestions} />}

        {!questionsLoading && !questionsError && questions.length === 0 && (
          <EmptyState title="Вопросов пока нет" description="Добавьте вопросы для этой папки." />
        )}

        {!questionsLoading && !questionsError && questions.length > 0 && (
          <div className="space-y-2">
            {questions.map((question) => (
              <div key={question.id} className="border-subtle bg-app rounded-2xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{question.prompt}</div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{question.type}</span>
                  {!question.active && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Скрыт</span>
                  )}
                </div>

                {question.explanation && <div className="mt-1 text-sm text-muted">{question.explanation}</div>}
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
