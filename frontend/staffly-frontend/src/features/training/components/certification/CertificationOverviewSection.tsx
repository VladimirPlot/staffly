import { RotateCcw } from "lucide-react";
import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import Icon from "../../../../shared/ui/Icon";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import CertificationSummaryCards from "./CertificationSummaryCards";
import type { TrainingExamDto } from "../../api/types";
import type { CertificationManagerActionsState, CertificationSummaryState } from "../../hooks/certification/types";

type Props = {
  canManage: boolean;
  exam: TrainingExamDto | null;
  summaryState: CertificationSummaryState;
  managerActions: CertificationManagerActionsState;
};

export default function CertificationOverviewSection({ canManage, exam, summaryState, managerActions }: Props) {
  if (!exam) {
    return (
      <Card>
        <div className="text-sm text-muted">Выберите аттестацию, чтобы увидеть сводку.</div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{exam.title}</div>
          <div className="text-sm text-muted">Assignment-aware аналитика аттестации</div>
        </div>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icon icon={RotateCcw} size="xs" />}
            className="shrink-0 self-start"
            isLoading={managerActions.loadingActionKey === "reset:exam"}
            onClick={() => void managerActions.resetExamCycle()}
          >
            Глобально сбросить цикл
          </Button>
        )}
      </div>
      {managerActions.error && <div className="text-sm text-red-600">{managerActions.error}</div>}
      {summaryState.loading && <LoadingState label="Загрузка сводки..." />}
      {summaryState.error && <ErrorState message={summaryState.error} onRetry={summaryState.reload} />}
      {summaryState.summary && <CertificationSummaryCards summary={summaryState.summary} />}
    </Card>
  );
}
