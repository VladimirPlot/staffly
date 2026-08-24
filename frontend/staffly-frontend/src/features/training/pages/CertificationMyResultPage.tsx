import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { getMyCertificationResult } from "../api/trainingApi";
import type { CertificationMyResultDto } from "../api/types";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import CertificationQuestionReviewSection from "../components/certification/CertificationQuestionReviewSection";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { formatDateTime } from "../utils/certificationResultFormatting";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

function currentStatusLabel(status?: CertificationMyResultDto["currentAssignmentStatus"]): string {
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

  const attemptsLeft = data == null || data.attemptsAllowed == null ? null : data.attemptsAllowed - data.attemptsUsed;
  const hasPreviousUnfinished = data != null && data.unfinishedAttemptId != null
    && data.unfinishedAssignmentId !== data.currentAssignmentId;
  const canActOnCurrent = data != null && data.currentAssignmentId != null && (
    data.currentAssignmentStatus === "ASSIGNED"
    || data.currentAssignmentStatus === "IN_PROGRESS"
    || (data.currentAssignmentStatus === "FAILED" && (attemptsLeft == null || attemptsLeft > 0))
  );
  const canOpenRuntime = data != null && (data.unfinishedAttemptId != null || canActOnCurrent);
  const actionLabel = hasPreviousUnfinished
    ? "Продолжить предыдущую попытку"
    : data?.currentAssignmentStatus === "IN_PROGRESS" || data?.unfinishedAttemptId != null
      ? "Продолжить аттестацию"
      : data?.currentAssignmentStatus === "FAILED"
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

            {data.currentAssignmentId != null && (
              <div className="rounded-2xl border border-subtle bg-app p-3">
                <div className="font-medium text-default">Текущее назначение</div>
                <div className="mt-1 text-sm text-muted">
                  Версия {data.currentAssignmentVersion ?? "—"} · {currentStatusLabel(data.currentAssignmentStatus)}
                  {data.currentAssignmentCycleSequence != null && ` · цикл ${data.currentAssignmentCycleSequence}`}
                </div>
                <div className="mt-1 text-sm text-muted">
                  Попыток: {data.attemptsAllowed == null ? `${data.attemptsUsed}/∞` : `${data.attemptsUsed}/${data.attemptsAllowed}`}
                </div>
                {data.currentAssignmentStatus === "PASSED" && (
                  <div className="mt-1 text-sm text-emerald-700">
                    Результат: {data.validResultScorePercent == null ? "—" : `${data.validResultScorePercent}%`}
                    {data.validResultPassedAt && ` · ${formatDateTime(data.validResultPassedAt)}`}
                  </div>
                )}
              </div>
            )}

            {data.validResultAssignmentId != null && data.validResultAssignmentId !== data.currentAssignmentId && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="font-medium text-emerald-900">Предыдущая аттестация</div>
                <div className="mt-1 text-sm text-emerald-800">
                  Версия {data.validResultVersion ?? "—"} · Пройдено · {data.validResultScorePercent == null ? "—" : `${data.validResultScorePercent}%`}
                  {data.validResultPassedAt && ` · ${formatDateTime(data.validResultPassedAt)}`}
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

          {data.questions.length === 0 && <Card className="text-sm text-muted">Завершённой попытки пока нет — сначала пройдите аттестацию.</Card>}

          {data.questions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-default">
                Разбор завершённого результата версии {data.validResultVersion ?? data.currentAssignmentVersion ?? "—"}
              </div>
              <CertificationQuestionReviewSection
                questions={data.questions}
                revealCorrectAnswers={data.revealCorrectAnswers}
                hiddenCorrectAnswersHint="Правильные ответы будут доступны после завершения всех попыток."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
