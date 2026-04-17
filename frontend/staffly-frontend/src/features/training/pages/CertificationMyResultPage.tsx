import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { getMyCertificationResult } from "../api/trainingApi";
import type { CertificationMyResultDto } from "../api/types";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function formatParsedAnswer(parsed: unknown): string {
  if (typeof parsed === "string") return parsed;
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if ("left" in item && "right" in item) return `${String(item.left)} → ${String(item.right ?? "")}`;
          if ("blankIndex" in item && "value" in item) return `${String(item.blankIndex)}: ${String(item.value ?? "")}`;
          if ("blankIndex" in item && "correct" in item) {
            return `${String(item.blankIndex)}: ${String(item.correct ?? "")}`;
          }
        }
        return JSON.stringify(item);
      })
      .join(", ");
  }
  if (parsed && typeof parsed === "object") {
    if ("blankIndex" in parsed && "value" in parsed) {
      return `${String(parsed.blankIndex)}: ${String(parsed.value ?? "")}`;
    }
    if ("blankIndex" in parsed && "correct" in parsed) {
      return `${String(parsed.blankIndex)}: ${String(parsed.correct ?? "")}`;
    }
  }
  return JSON.stringify(parsed);
}

function renderAnswer(rawAnswerJson?: string | null, emptyLabel = "Ответ не указан"): string {
  if (!rawAnswerJson) return emptyLabel;
  try {
    const parsed = JSON.parse(rawAnswerJson);
    return formatParsedAnswer(parsed);
  } catch {
    return rawAnswerJson;
  }
}

function isPassedResult(data: CertificationMyResultDto): boolean {
  if (data.passedAt) return true;
  return data.assignmentStatus === "PASSED";
}

export default function CertificationMyResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const parsedExamId = Number(examId);
  const navigate = useNavigate();
  const { restaurantId } = useTrainingAccess();
  const [data, setData] = useState<CertificationMyResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId || Number.isNaN(parsedExamId)) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getMyCertificationResult(restaurantId, parsedExamId);
      setData(result);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить личный результат аттестации."));
    } finally {
      setLoading(false);
    }
  }, [parsedExamId, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attemptsLeft = data == null || data.attemptsAllowed == null ? null : data.attemptsAllowed - data.attemptsUsed;
  const canRestart = data != null && !isPassedResult(data) && (attemptsLeft == null || attemptsLeft > 0);
  const questions = useMemo(() => {
    if (!data) return [];
    return onlyWrong ? data.questions.filter((question) => !question.correct) : data.questions;
  }, [data, onlyWrong]);

  const restart = async () => {
    if (!data || restarting) return;
    setRestarting(true);
    setError(null);
    try {
      navigate(trainingRoutes.examRun(data.examId));
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации", to: trainingRoutes.exams }, { label: "Мой результат" }]} />
      <h2 className="text-2xl font-semibold text-default">Личный результат аттестации</h2>
      {loading && <LoadingState label="Загрузка личной аналитики..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {data && !loading && (
        <>
          <Card className="space-y-3">
            <div className="text-lg font-semibold">{data.title}</div>
            {data.description && <div className="text-sm text-muted">{data.description}</div>}
            <div className="text-sm text-muted">
              Статус: {data.scorePercent == null ? "нет завершённой попытки" : isPassedResult(data) ? "сдано" : "не сдано"} ·
              Итог: {data.scorePercent == null ? "—" : `${data.scorePercent}%`} ·
              Лучший результат: {data.bestScore == null ? "—" : `${data.bestScore}%`} ·
              Попыток: {data.attemptsAllowed == null ? `${data.attemptsUsed}/∞` : `${data.attemptsUsed}/${data.attemptsAllowed}`}
            </div>
            <div className="text-sm text-muted">
              Последняя попытка: {formatDateTime(data.lastAttemptAt)} · Дата сдачи: {formatDateTime(data.passedAt)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={trainingRoutes.exams}><Button variant="outline">К аттестациям</Button></Link>
              {canRestart && <Button onClick={restart} isLoading={restarting}>Перезапустить</Button>}
            </div>
          </Card>

          {data.questions.length === 0 && <Card className="text-sm text-muted">Завершённой попытки пока нет — сначала пройдите аттестацию.</Card>}

          {data.questions.length > 0 && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-default">Разбор вопросов</div>
                <label className="inline-flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={onlyWrong} onChange={(event) => setOnlyWrong(event.target.checked)} />
                  Показать только ошибки
                </label>
              </div>
              {!data.revealCorrectAnswers && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Правильные ответы будут доступны после завершения всех попыток.
                </div>
              )}
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div key={`${question.questionId}-${index}`} className={`rounded-xl border p-3 ${question.correct ? "border-emerald-200" : "border-rose-200 bg-rose-50/40"}`}>
                    <div className="text-sm font-medium">#{index + 1}. {question.prompt}</div>
                    <div className="mt-1 text-sm text-muted">Ваш ответ: {renderAnswer(question.chosenAnswerJson)}</div>
                    {data.revealCorrectAnswers && (
                      <div className="mt-1 text-sm text-muted">Правильный ответ: {renderAnswer(question.correctAnswerJson, "—")}</div>
                    )}
                    <div className={`mt-1 text-sm ${question.correct ? "text-emerald-700" : "text-rose-700"}`}>{question.correct ? "Верно" : "Ошибка"}</div>
                    {question.explanation && <div className="mt-2 text-sm text-muted">Пояснение: {question.explanation}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
