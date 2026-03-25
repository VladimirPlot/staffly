import Card from "../../../../shared/ui/Card";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import type { CertificationEmployeeAttemptsState } from "../../hooks/certification/types";

type Props = {
  selectedEmployeeFullName: string | null;
  attemptsState: CertificationEmployeeAttemptsState;
};

export default function CertificationAttemptsSection({ selectedEmployeeFullName, attemptsState }: Props) {
  if (!selectedEmployeeFullName) return null;

  return (
    <Card className="space-y-3">
      <div className="text-sm font-semibold">История попыток: {selectedEmployeeFullName}</div>
      {attemptsState.loading && <LoadingState label="Загрузка попыток..." />}
      {attemptsState.error && <ErrorState message={attemptsState.error} onRetry={() => void attemptsState.load()} />}
      {!attemptsState.loading && attemptsState.attempts.length === 0 && (
        <div className="text-sm text-muted">Попыток пока нет.</div>
      )}
      {!attemptsState.loading && attemptsState.attempts.length > 0 && (
        <div className="space-y-2">
          {attemptsState.attempts.map((attempt) => (
            <div key={attempt.attemptId} className="rounded-xl border border-subtle p-3 text-sm">
              <div>Начало: {new Date(attempt.startedAt).toLocaleString()}</div>
              <div>Окончание: {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : "—"}</div>
              <div>Балл: {attempt.scorePercent ?? "—"}%</div>
              <div>Версия экзамена: {attempt.assignmentExamVersionSnapshot ?? attempt.examVersion ?? "—"}</div>
              <div>Статус: {attempt.passed == null ? "—" : attempt.passed ? "Сдано" : "Не сдано"}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
