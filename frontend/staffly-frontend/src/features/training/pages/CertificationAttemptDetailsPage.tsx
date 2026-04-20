import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { getCertificationAttemptDetails } from "../api/trainingApi";
import type { CertificationAttemptDetailsDto } from "../api/types";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import CertificationQuestionReviewSection from "../components/certification/CertificationQuestionReviewSection";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { formatDateTime } from "../utils/certificationResultFormatting";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

function formatDuration(durationSec?: number | null): string {
  if (durationSec == null) return "—";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}м ${seconds}с`;
}

export default function CertificationAttemptDetailsPage() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
  const parsedExamId = Number(examId);
  const parsedAttemptId = Number(attemptId);
  const { restaurantId, canManage } = useTrainingAccess();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<CertificationAttemptDetailsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = useMemo(() => {
    const raw = searchParams.get("returnTo");
    if (!raw) return trainingRoutes.exams;
    try {
      const decoded = decodeURIComponent(raw);
      return decoded.startsWith("/training/exams") ? decoded : trainingRoutes.exams;
    } catch {
      return trainingRoutes.exams;
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!restaurantId || !Number.isFinite(parsedExamId) || !Number.isFinite(parsedAttemptId)) return;
    setLoading(true);
    setError(null);
    try {
      const details = await getCertificationAttemptDetails(restaurantId, parsedExamId, parsedAttemptId);
      setData(details);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить детальный разбор попытки."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, parsedExamId, parsedAttemptId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canManage) {
    return <ErrorState message="У вас нет доступа к этому разбору попытки." onRetry={() => navigate(returnTo)} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs
        items={[
          { label: "Тренинг", to: trainingRoutes.landing },
          { label: "Аттестации", to: trainingRoutes.exams },
          { label: "Аналитика", to: returnTo },
          { label: "Попытка" },
        ]}
      />

      <h2 className="text-2xl font-semibold text-default">Детальный разбор попытки</h2>
      {loading && <LoadingState label="Загрузка попытки..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {data && !loading && (
        <>
          <Card className="space-y-3">
            <div className="text-lg font-semibold">{data.examTitle}</div>
            {data.examDescription && <div className="text-sm text-muted">{data.examDescription}</div>}
            <div className="text-sm text-muted">
              Сотрудник: {data.userFullName} · Статус: {data.passed ? "сдано" : "не сдано"} · Итог: {data.scorePercent ?? "—"}% · Проходной балл: {data.passPercent}%
            </div>
            <div className="text-sm text-muted">
              Начало: {formatDateTime(data.startedAt)} · Завершение: {formatDateTime(data.finishedAt)} · Длительность: {formatDuration(data.durationSec)}
            </div>
            <div className="text-sm text-muted">
              Версия экзамена: {data.examVersion ?? "—"} · Вопросов: {data.questionCount ?? data.questions.length}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={returnTo}><Button variant="outline">Назад к аналитике</Button></Link>
            </div>
          </Card>

          <CertificationQuestionReviewSection
            questions={data.questions}
            revealCorrectAnswers
          />
        </>
      )}
    </div>
  );
}
