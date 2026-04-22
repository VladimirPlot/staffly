import Card from "../../../../shared/ui/Card";
import { useSearchParams } from "react-router-dom";
import type { CertificationEmployeeAttemptsState } from "../../hooks/certification/types";
import { trainingRoutes } from "../../utils/trainingRoutes";
import CertificationAttemptHistoryList from "./CertificationAttemptHistoryList";

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
      {selectedEmployeeUserId && (
        <CertificationAttemptHistoryList
          examId={examId}
          userId={selectedEmployeeUserId}
          attempts={attemptsState.attempts}
          loading={attemptsState.loading}
          error={attemptsState.error}
          returnTo={search ? `${analyticsPath}?${search}` : analyticsPath}
          onRetry={() => void attemptsState.reload()}
        />
      )}
    </Card>
  );
}
