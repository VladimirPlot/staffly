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

  const launchRecertification = () => {
    const confirmed = window.confirm(
      "Всем сотрудникам текущей аудитории будет назначено повторное прохождение актуальной версии теста.\n\n" +
        "Предыдущие результаты сохранятся.\n\n" +
        "Если сотрудник уже проходит предыдущую попытку, он сможет завершить её, но после этого ему всё равно потребуется пройти новый цикл.",
    );
    if (confirmed) void managerActions.resetExamCycle();
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold">{exam.title}</div>
            {!exam.active && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Аттестация скрыта
              </span>
            )}
          </div>
          <div className="text-sm text-muted">Assignment-aware аналитика аттестации</div>
          {!exam.active && <div className="text-sm text-amber-700">Сотрудникам тест недоступен</div>}
        </div>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icon icon={RotateCcw} size="xs" />}
            className="shrink-0 self-start"
            isLoading={managerActions.loadingActionKey === "reset:exam"}
            onClick={launchRecertification}
          >
            Запустить новый цикл аттестации
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
