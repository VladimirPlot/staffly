import Card from "../../../../shared/ui/Card";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../../../../shared/ui/Button";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import type { CertificationEmployeeAttemptsState } from "../../hooks/certification/types";
import { trainingRoutes } from "../../utils/trainingRoutes";

type Props = {
  examId: number;
  selectedEmployeeUserId: number | null;
  selectedEmployeeFullName: string | null;
  attemptsState: CertificationEmployeeAttemptsState;
};

export default function CertificationAttemptsSection({ examId, selectedEmployeeUserId, selectedEmployeeFullName, attemptsState }: Props) {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const analyticsPath = trainingRoutes.examAnalytics(examId);
  const returnTo = encodeURIComponent(search ? `${analyticsPath}?${search}` : analyticsPath);

  if (!selectedEmployeeFullName) {
    return (
      <Card>
        <div className="text-sm text-muted">Выберите сотрудника, чтобы увидеть историю попыток.</div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="text-sm font-semibold">История попыток: {selectedEmployeeFullName}</div>
      {attemptsState.loading && <LoadingState label="Загрузка попыток..." />}
      {attemptsState.error && <ErrorState message={attemptsState.error} onRetry={() => void attemptsState.reload()} />}
      {!attemptsState.loading && !attemptsState.error && attemptsState.attempts.length === 0 && (
        <div className="text-sm text-muted">Попыток пока нет.</div>
      )}
      {!attemptsState.loading && !attemptsState.error && attemptsState.attempts.length > 0 && (
        <div className="space-y-2">
          {attemptsState.attempts.map((attempt) => (
            <div key={attempt.attemptId} className="rounded-xl border border-subtle p-3 text-sm">
              <div>Начало: {new Date(attempt.startedAt).toLocaleString()}</div>
              <div>Окончание: {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : "—"}</div>
              <div>Балл: {attempt.scorePercent ?? "—"}%</div>
              <div>Версия экзамена: {attempt.assignmentExamVersionSnapshot ?? attempt.examVersion ?? "—"}</div>
              <div>Статус: {attempt.passed == null ? "—" : attempt.passed ? "Сдано" : "Не сдано"}</div>
              {selectedEmployeeUserId && (
                <div className="mt-2">
                  <Link
                    to={`${trainingRoutes.examAttemptAnalytics(examId, attempt.attemptId)}?userId=${selectedEmployeeUserId}&returnTo=${returnTo}`}
                  >
                    <Button size="sm" variant="outline">Подробнее</Button>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
