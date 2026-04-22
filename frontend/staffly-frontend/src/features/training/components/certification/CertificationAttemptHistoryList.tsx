import { Link } from "react-router-dom";
import Button from "../../../../shared/ui/Button";
import type { CertificationExamAttemptHistoryDto } from "../../api/types";
import { formatDateTime } from "../../utils/certificationResultFormatting";
import { withReturnToParam } from "../../utils/returnTo";
import { trainingRoutes } from "../../utils/trainingRoutes";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";

type Props = {
  examId: number;
  attempts: CertificationExamAttemptHistoryDto[];
  loading: boolean;
  error: string | null;
  returnTo: string;
  onRetry: () => void;
  emptyLabel?: string;
};

export default function CertificationAttemptHistoryList({
  examId,
  attempts,
  loading,
  error,
  returnTo,
  onRetry,
  emptyLabel = "Попыток пока нет.",
}: Props) {
  if (loading) {
    return <LoadingState label="Загрузка попыток..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (attempts.length === 0) {
    return <div className="text-sm text-muted">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {attempts.map((attempt) => (
        <div key={attempt.attemptId} className="rounded-xl border border-subtle p-3 text-sm">
          <div>Начало: {formatDateTime(attempt.startedAt)}</div>
          <div>Окончание: {formatDateTime(attempt.finishedAt)}</div>
          <div>Балл: {attempt.scorePercent ?? "—"}%</div>
          <div>Версия экзамена: {attempt.assignmentExamVersionSnapshot ?? attempt.examVersion ?? "—"}</div>
          <div>Статус: {attempt.passed == null ? "—" : attempt.passed ? "Сдано" : "Не сдано"}</div>
          <div className="mt-2">
            <Link
              to={withReturnToParam(trainingRoutes.examAttemptAnalytics(examId, attempt.attemptId), returnTo)}
            >
              <Button size="sm" variant="outline">Подробнее</Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
