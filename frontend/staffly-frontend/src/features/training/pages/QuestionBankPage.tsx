import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FolderList from "../components/FolderList";
import LoadingState from "../components/LoadingState";
import { mapQuestionsForUi } from "../api/mappers";
import { deleteQuestion, hideQuestion, listQuestions, restoreQuestion } from "../api/trainingApi";
import type { TrainingFolderDto, TrainingQuestionDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function QuestionBankPage() {
  const { restaurantId, canManage, loading: accessLoading } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "QUESTION_BANK", canManage });

  const [selectedFolder, setSelectedFolder] = useState<TrainingFolderDto | null>(null);
  const [questions, setQuestions] = useState<TrainingQuestionDto[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [questionActionLoadingId, setQuestionActionLoadingId] = useState<number | null>(null);

  const loadQuestions = useCallback(async () => {
    if (!restaurantId || !selectedFolder || !canManage) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const response = await listQuestions(restaurantId, selectedFolder.id, foldersState.includeInactive);
      setQuestions(mapQuestionsForUi(response));
    } catch (e) {
      setQuestionsError(getTrainingErrorMessage(e, "Не удалось загрузить вопросы."));
    } finally {
      setQuestionsLoading(false);
    }
  }, [restaurantId, selectedFolder, foldersState.includeInactive, canManage]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const runQuestionAction = async (questionId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setQuestionActionLoadingId(questionId);
    try {
      if (action === "hide") await hideQuestion(restaurantId, questionId);
      if (action === "restore") await restoreQuestion(restaurantId, questionId);
      if (action === "delete") await deleteQuestion(restaurantId, questionId);
      await loadQuestions();
    } catch (e) {
      setQuestionsError(getTrainingErrorMessage(e, "Не удалось выполнить действие с вопросом."));
    } finally {
      setQuestionActionLoadingId(null);
    }
  };

  if (!accessLoading && !canManage) {
    return <Navigate to={trainingRoutes.landing} replace />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Банк вопросов" }]} />
      <h2 className="text-2xl font-semibold">🧠 Банк вопросов</h2>

      <label className="inline-flex items-center gap-2 text-sm text-default">
        <input
          type="checkbox"
          checked={foldersState.includeInactive}
          onChange={(e) => foldersState.setIncludeInactive(e.target.checked)}
        />
        Показывать скрытые
      </label>

      {foldersState.loading && <LoadingState label="Загрузка папок банка вопросов…" />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {!foldersState.loading && !foldersState.error && foldersState.folders.length === 0 && (
        <EmptyState title="Папки не найдены" description="Создайте первую папку банка вопросов." />
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
          <h3 className="text-lg font-semibold">Вопросы папки: {selectedFolder.name}</h3>
          {questionsLoading && <LoadingState label="Загрузка вопросов…" />}
          {questionsError && <ErrorState message={questionsError} onRetry={loadQuestions} />}
          {!questionsLoading && !questionsError && questions.length === 0 && (
            <EmptyState title="Вопросов пока нет" description="Добавьте вопросы для этой папки." />
          )}

          {!questionsLoading && !questionsError && questions.length > 0 && (
            <div className="space-y-2">
              {questions.map((question) => (
                <div key={question.id} className="rounded-2xl border border-subtle bg-app p-3">
                  <div className="font-medium">{question.text}</div>
                  {question.explanation && <div className="mt-1 text-sm text-muted">{question.explanation}</div>}
                  {!question.active && <div className="mt-1 text-xs text-amber-600">Скрыт</div>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={questionActionLoadingId === question.id}
                        onClick={() => runQuestionAction(question.id, "hide")}
                      >
                        Скрыть
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={questionActionLoadingId === question.id}
                          onClick={() => runQuestionAction(question.id, "restore")}
                        >
                          Восстановить
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={questionActionLoadingId === question.id}
                          onClick={() => runQuestionAction(question.id, "delete")}
                        >
                          Удалить
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
