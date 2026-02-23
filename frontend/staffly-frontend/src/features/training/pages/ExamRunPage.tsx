import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { startExam, submitExamAttempt } from "../api/trainingApi";
import type { ExamAttemptDto, ExamSubmitResultDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function ExamRunPage() {
  const { examId } = useParams<{ examId: string }>();
  const parsedExamId = Number(examId);
  const navigate = useNavigate();
  const { restaurantId } = useTrainingAccess();

  const [attempt, setAttempt] = useState<ExamAttemptDto | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamSubmitResultDto | null>(null);

  const loadAttempt = async () => {
    if (!restaurantId || Number.isNaN(parsedExamId)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await startExam(restaurantId, parsedExamId);
      setAttempt(response);
      setAnswers({});
      setResult(null);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось запустить аттестацию."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttempt();
  }, [restaurantId, parsedExamId]);

  const answeredCount = useMemo(
    () => Object.keys(answers).filter((key) => typeof answers[Number(key)] === "number").length,
    [answers]
  );

  const submit = async () => {
    if (!restaurantId || !attempt) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await submitExamAttempt(restaurantId, attempt.attemptId, {
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId: Number(questionId),
          optionId,
        })),
      });
      setResult(response);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось отправить ответы."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs
        items={[
          { label: "Тренинг", to: trainingRoutes.landing },
          { label: "Аттестации", to: trainingRoutes.exams },
          { label: "Прохождение" },
        ]}
      />

      <h2 className="text-2xl font-semibold">Прохождение аттестации</h2>

      {loading && <LoadingState label="Запускаем аттестацию…" />}
      {error && <ErrorState message={error} onRetry={loadAttempt} />}

      {attempt && !loading && (
        <Card className="space-y-4">
          <div className="text-sm text-muted">
            Вопросов: {attempt.questions.length}. Отвечено: {answeredCount}.
          </div>

          <div className="space-y-3">
            {attempt.questions.map((question, idx) => (
              <div key={question.id} className="rounded-2xl border border-subtle bg-app p-3">
                <div className="font-medium">{idx + 1}. {question.text}</div>
                <div className="mt-2 space-y-2">
                  {question.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm text-default">
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={answers[question.id] === option.id}
                        onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={submit} isLoading={submitting}>
              Отправить ответы
            </Button>
            <Button variant="outline" onClick={() => navigate(trainingRoutes.exams)}>
              К списку аттестаций
            </Button>
          </div>

          {result && (
            <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
              {result.passed ? "Поздравляем! Аттестация сдана." : "Аттестация не сдана."} Результат: {result.scorePercent}% ({result.correctAnswers}/{result.totalQuestions}).
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
