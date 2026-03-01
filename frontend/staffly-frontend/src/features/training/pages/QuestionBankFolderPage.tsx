import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Input from "../../../shared/ui/Input";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import QuestionDeleteGuardModal from "../components/QuestionDeleteGuardModal";
import QuestionEditorModal from "../components/QuestionEditorModal";
import TrainingFolderModal from "../components/TrainingFolderModal";
import TrainingToast from "../components/TrainingToast";
import { deleteFolder, deleteQuestion, hideQuestion, listQuestions, restoreQuestion } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingQuestionDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { bySortOrderAndName } from "../utils/sort";
import { buildQuestionDeleteDialogModel, type QuestionDeleteDialogModel } from "../utils/questionDeleteUx";
import { parseTrainingApiError } from "../utils/trainingApiError";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function QuestionBankFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "QUESTION_BANK", canManage });
  const [questions, setQuestions] = useState<TrainingQuestionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TrainingQuestionDto | null>(null);
  const [questionActionLoadingId, setQuestionActionLoadingId] = useState<number | null>(null);
  const [guardedQuestion, setGuardedQuestion] = useState<TrainingQuestionDto | null>(null);
  const [deleteDialogModel, setDeleteDialogModel] = useState<QuestionDeleteDialogModel | null>(null);
  const [guardActionLoading, setGuardActionLoading] = useState<"hideAndDelete" | "hideOnly" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

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
    setLoading(true);
    setError(null);
    try {
      setQuestions(
        await listQuestions(
          restaurantId,
          currentFolder.id,
          canManage ? foldersState.includeInactive : false,
          debouncedSearch
        )
      );
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить вопросы папки."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, currentFolder, canManage, foldersState.includeInactive, debouncedSearch]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const closeDeleteModal = useCallback(() => {
    if (guardActionLoading) return;
    setDeleteDialogModel(null);
    setGuardedQuestion(null);
  }, [guardActionLoading]);

  const runQuestionAction = useCallback(
    async (question: TrainingQuestionDto, action: "hide" | "restore" | "delete") => {
      if (!restaurantId) return;
      setQuestionActionLoadingId(question.id);
      setError(null);

      try {
        if (action === "hide") {
          await hideQuestion(restaurantId, question.id);
          setToastMessage("Вопрос скрыт.");
          await loadQuestions();
          return;
        }

        if (action === "restore") {
          await restoreQuestion(restaurantId, question.id);
          setToastMessage("Вопрос восстановлен.");
          await loadQuestions();
          return;
        }

        await deleteQuestion(restaurantId, question.id);
        setToastMessage("Вопрос удалён.");
        await loadQuestions();
      } catch (e) {
        const parsedError = parseTrainingApiError(e);

        if (action === "delete" && parsedError.status === 409) {
          setGuardedQuestion(question);
          setDeleteDialogModel(buildQuestionDeleteDialogModel(parsedError));
          return;
        }

        setError(getTrainingErrorMessage(e, "Не удалось выполнить действие с вопросом."));
      } finally {
        setQuestionActionLoadingId(null);
      }
    },
    [restaurantId, loadQuestions]
  );

  const handleHideAndDelete = useCallback(async () => {
    if (!restaurantId || !guardedQuestion) return;
    setGuardActionLoading("hideAndDelete");
    setError(null);

    try {
      await hideQuestion(restaurantId, guardedQuestion.id);
      await deleteQuestion(restaurantId, guardedQuestion.id);
      setToastMessage("Вопрос скрыт и удалён.");
      closeDeleteModal();
      await loadQuestions();
    } catch (e) {
      const parsedError = parseTrainingApiError(e);
      if (parsedError.status === 409) {
        setDeleteDialogModel(buildQuestionDeleteDialogModel(parsedError));
      } else {
        setError(getTrainingErrorMessage(e, "Не удалось скрыть и удалить вопрос."));
      }
    } finally {
      setGuardActionLoading(null);
    }
  }, [restaurantId, guardedQuestion, closeDeleteModal, loadQuestions]);

  const handleHideOnly = useCallback(async () => {
    if (!restaurantId || !guardedQuestion) return;
    setGuardActionLoading("hideOnly");
    setError(null);

    try {
      await hideQuestion(restaurantId, guardedQuestion.id);
      setToastMessage("Вопрос скрыт.");
      closeDeleteModal();
      await loadQuestions();
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось скрыть вопрос."));
    } finally {
      setGuardActionLoading(null);
    }
  }, [restaurantId, guardedQuestion, closeDeleteModal, loadQuestions]);

  const handleCopyExams = useCallback(async () => {
    if (!deleteDialogModel || deleteDialogModel.exams.length === 0) return;
    const examNames = deleteDialogModel.exams.map((exam) => exam.title).join("\n");
    try {
      await navigator.clipboard.writeText(examNames);
      setToastMessage("Список тестов скопирован.");
    } catch {
      setError("Не удалось скопировать список тестов.");
    }
  }, [deleteDialogModel]);

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; to?: string }[] = [
      { label: "Тренинг", to: trainingRoutes.landing },
      { label: "Банк вопросов", to: trainingRoutes.questionBank },
    ];
    if (!currentFolder) return items;
    const chain: TrainingFolderDto[] = [];
    let cursor: TrainingFolderDto | null = currentFolder;
    const seen = new Set<number>();
    while (cursor && !seen.has(cursor.id)) {
      chain.unshift(cursor);
      seen.add(cursor.id);
      cursor = cursor.parentId ? folderMap.get(cursor.parentId) ?? null : null;
    }
    chain.forEach((f, i) =>
      items.push({ label: f.name, to: i === chain.length - 1 ? undefined : trainingRoutes.questionBankFolder(f.id) })
    );
    return items;
  }, [currentFolder, folderMap]);

  if (Number.isNaN(currentFolderId)) {
    return <ErrorState message="Папка не найдена" actionLabel="К списку" onRetry={() => navigate(trainingRoutes.questionBank)} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={breadcrumbItems} />
      <h2 className="text-2xl font-semibold">{currentFolder?.name ?? "Папка"}</h2>

      {canManage && (
        <div className="border-subtle bg-surface space-y-2 rounded-2xl border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Switch
              label="Скрытые элементы"
              checked={foldersState.includeInactive}
              onChange={(event) => foldersState.setIncludeInactive(event.target.checked)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingFolder(null);
                  setFolderModalOpen(true);
                }}
              >
                Создать папку
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingQuestion(null);
                  setQuestionModalOpen(true);
                }}
              >
                Создать вопрос
              </Button>
            </div>
          </div>
          <Input label="Поиск по вопросам" placeholder="Поиск по вопросам" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
      {error && <ErrorState message={error} onRetry={loadQuestions} />}

      {childFolders.length > 0 && (
        <FolderList
          folders={childFolders}
          canManage={canManage}
          actionLoadingId={foldersState.actionLoadingId}
          onOpen={(id) => navigate(trainingRoutes.questionBankFolder(id))}
          onEdit={(folder) => {
            setEditingFolder(folder);
            setFolderModalOpen(true);
          }}
          onHide={foldersState.hide}
          onRestore={foldersState.restore}
          onDelete={async (id) => {
            if (!restaurantId) return;
            await deleteFolder(restaurantId, id);
            await foldersState.reload();
          }}
        />
      )}

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Вопросы</h3>
        {loading && <LoadingState label="Загрузка вопросов…" />}
        {!loading && questions.length === 0 && (
          <EmptyState title="Вопросов пока нет" description="Добавьте вопросы для этой папки." />
        )}

        {questions.map((question) => {
          const isQuestionLoading = questionActionLoadingId === question.id;

          return (
            <div key={question.id} className="border-subtle bg-app rounded-2xl border p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{question.title}</div>
                  <div className="text-sm text-muted">{question.prompt}</div>
                  <div className="text-xs text-muted">{question.type}</div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      disabled={isQuestionLoading}
                      onClick={() => {
                        setEditingQuestion(question);
                        setQuestionModalOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {question.active ? (
                      <Button
                        variant="ghost"
                        isLoading={isQuestionLoading}
                        onClick={() => runQuestionAction(question, "hide")}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        isLoading={isQuestionLoading}
                        onClick={() => runQuestionAction(question, "restore")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      isLoading={isQuestionLoading}
                      onClick={() => runQuestionAction(question, "delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {restaurantId && currentFolder && (
        <TrainingFolderModal
          open={folderModalOpen}
          mode={editingFolder ? "edit" : "create"}
          restaurantId={restaurantId}
          type="QUESTION_BANK"
          parentFolder={
            editingFolder ? (editingFolder.parentId ? folderMap.get(editingFolder.parentId) ?? null : null) : currentFolder
          }
          initialFolder={editingFolder}
          onClose={() => setFolderModalOpen(false)}
          onSaved={foldersState.reload}
        />
      )}
      {restaurantId && currentFolder && (
        <QuestionEditorModal
          open={questionModalOpen}
          restaurantId={restaurantId}
          folderId={currentFolder.id}
          question={editingQuestion}
          onClose={() => setQuestionModalOpen(false)}
          onSaved={loadQuestions}
        />
      )}

      <QuestionDeleteGuardModal
        open={Boolean(deleteDialogModel)}
        mode={deleteDialogModel?.mode ?? "GENERIC"}
        message={deleteDialogModel?.message ?? "Не удалось удалить вопрос."}
        exams={deleteDialogModel?.exams ?? []}
        loadingAction={guardActionLoading}
        onClose={closeDeleteModal}
        onHideAndDelete={() => void handleHideAndDelete()}
        onHideOnly={() => void handleHideOnly()}
        onOpenExams={() => navigate(trainingRoutes.exams)}
        onOpenExam={(examId) => navigate(trainingRoutes.exam(examId))}
        onCopyExamList={() => void handleCopyExams()}
      />

      <TrainingToast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
