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

function getAttemptPeriodText(data: CertificationMyResultDto): string {
  if (!data.lastAttemptStartedAt && !data.lastAttemptFinishedAt) {
    return "—";
  }
  return `Начало попытки: ${formatDateTime(data.lastAttemptStartedAt)} · Завершение: ${formatDateTime(data.lastAttemptFinishedAt)}`;
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
              {getAttemptPeriodText(data)}
              {data.passedAt && ` · Дата сдачи: ${formatDateTime(data.passedAt)}`}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={trainingRoutes.exams}><Button variant="outline">К аттестациям</Button></Link>
              {canRestart && <Button onClick={restart} isLoading={restarting}>Перезапустить</Button>}
            </div>
          </Card>

          {data.questions.length === 0 && <Card className="text-sm text-muted">Завершённой попытки пока нет — сначала пройдите аттестацию.</Card>}

          {data.questions.length > 0 && (
            <CertificationQuestionReviewSection
              questions={data.questions}
              revealCorrectAnswers={data.revealCorrectAnswers}
              hiddenCorrectAnswersHint="Правильные ответы будут доступны после завершения всех попыток."
            />
          )}
        </>
      )}
    </div>
  );
}
