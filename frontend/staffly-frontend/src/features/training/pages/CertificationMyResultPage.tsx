import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { getMyCertificationResult } from "../api/trainingApi";
import type { CertificationAssignmentStatus, CertificationMyResultDto } from "../api/types";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import CertificationQuestionReviewSection from "../components/certification/CertificationQuestionReviewSection";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { formatDateTime } from "../utils/certificationResultFormatting";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

function currentStatusLabel(status?: CertificationAssignmentStatus): string {
  switch (status) {
    case "ASSIGNED": return "Не начато";
    case "IN_PROGRESS": return "В процессе";
    case "PASSED": return "Пройдено";
    case "FAILED": return "Не сдано";
    case "EXHAUSTED": return "Попытки исчерпаны";
    case "ARCHIVED": return "Архивировано";
    default: return "Нет активного назначения";
  }
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

  const current = data?.currentObligation;
  const previous = data?.previousValidResult;
  const attemptsLeft = current == null || current.attemptsAllowed == null ? null : current.attemptsAllowed - current.attemptsUsed;
  const hasPreviousUnfinished = data != null && data.unfinishedAttemptId != null
    && data.unfinishedAssignmentId !== current?.assignmentId;
  const canActOnCurrent = current != null && (
    current.status === "ASSIGNED"
    || current.status === "IN_PROGRESS"
    || (current.status === "FAILED" && (attemptsLeft == null || attemptsLeft > 0))
  );
  const canOpenRuntime = data != null && (data.unfinishedAttemptId != null || canActOnCurrent);
  const actionLabel = hasPreviousUnfinished
    ? "Продолжить предыдущую попытку"
    : current?.status === "IN_PROGRESS" || data?.unfinishedAttemptId != null
      ? "Продолжить аттестацию"
      : current?.status === "FAILED"
        ? "Повторить попытку"
        : "Начать аттестацию";
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
              Опубликована версия {data.latestPublishedVersion}
            </div>

            {current && (
              <div className="rounded-2xl border border-subtle bg-app p-3">
                <div className="font-medium text-default">Текущая аттестация</div>
                <div className="mt-1 text-sm text-muted">
                  Версия {current.version} · {currentStatusLabel(current.status)}
                  {current.cycleSequence != null && ` · цикл ${current.cycleSequence}`}
                </div>
                <div className="mt-1 text-sm text-muted">
                  Попыток: {current.attemptsAllowed == null ? `${current.attemptsUsed} из ∞` : `${current.attemptsUsed} из ${current.attemptsAllowed}`}
                </div>
                {current.bestScore != null && (
                  <div className="mt-1 text-sm text-emerald-700">
                    Результат: {current.bestScore}%
                    {current.passedAt && ` · ${formatDateTime(current.passedAt)}`}
                  </div>
                )}
              </div>
            )}

            {previous && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="font-medium text-emerald-900">
                  {current ? "Предыдущий результат" : "Результат аттестации"}
                </div>
                <div className="mt-1 text-sm text-emerald-800">
                  Версия {previous.version} · Пройдено · {previous.bestScore == null ? "—" : `${previous.bestScore}%`}
                  {previous.passedAt && ` · ${formatDateTime(previous.passedAt)}`}
                  {previous.cycleSequence != null && ` · цикл ${previous.cycleSequence}`}
                </div>
              </div>
            )}
            {data.unfinishedAttemptId != null && (
              <div className="text-sm text-amber-700">
                Есть незавершённая попытка версии {data.unfinishedAttemptVersion ?? "—"}.
                {data.hasPendingNewerObligation && " После неё потребуется пройти текущее назначение."}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to={trainingRoutes.exams}><Button variant="outline">К аттестациям</Button></Link>
              {canOpenRuntime && <Button onClick={restart} isLoading={restarting}>{actionLabel}</Button>}
            </div>
          </Card>

          {!current?.questions.length && !previous?.questions.length && <Card className="text-sm text-muted">Завершённой попытки пока нет — сначала пройдите аттестацию.</Card>}

          {current && current.questions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-default">
                Разбор текущей аттестации версии {current.version}
              </div>
              <CertificationQuestionReviewSection
                questions={current.questions}
                revealCorrectAnswers={current.revealCorrectAnswers}
                hiddenCorrectAnswersHint="Правильные ответы будут доступны после завершения всех попыток."
              />
            </div>
          )}
          {previous && previous.questions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-default">Разбор предыдущего результата версии {previous.version}</div>
              <CertificationQuestionReviewSection
                questions={previous.questions}
                revealCorrectAnswers={previous.revealCorrectAnswers}
                hiddenCorrectAnswersHint="Правильные ответы будут доступны после завершения всех попыток."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
