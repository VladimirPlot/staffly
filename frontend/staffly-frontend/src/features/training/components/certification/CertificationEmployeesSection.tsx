import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import DropdownSelect from "../../../../shared/ui/DropdownSelect";
import type { CertificationAnalyticsStatus } from "../../api/types";
import type { CertificationEmployeesState, CertificationManagerActionsState, CertificationStatusFilter } from "../../hooks/certification/types";
import { getCertificationAnalyticsStatusLabel } from "../../utils/certificationAssignment";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import CertificationStatusBadge from "./CertificationStatusBadge";

type Props = {
  canManage: boolean;
  hasSelectedExam: boolean;
  employeesState: CertificationEmployeesState;
  managerActions: CertificationManagerActionsState;
  statusFilter: CertificationStatusFilter;
  onStatusFilterChange: (next: CertificationStatusFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onShowAttempts: (userId: number | null) => void;
};

const STATUS_OPTIONS: CertificationAnalyticsStatus[] = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED"];

export default function CertificationEmployeesSection({
  canManage,
  hasSelectedExam,
  employeesState,
  managerActions,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  onShowAttempts,
}: Props) {
  if (!hasSelectedExam) {
    return (
      <Card>
        <div className="text-sm text-muted">Выберите аттестацию, чтобы увидеть сотрудников и назначения.</div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="text-sm font-semibold">Сотрудники</div>
        <div className="flex flex-wrap gap-2">
          <input className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Поиск по ФИО" />
          <DropdownSelect aria-label="Статус" className="rounded-xl px-3 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(toStatusFilter(event.target.value))}>
            <option value="ALL">Все статусы</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{getCertificationAnalyticsStatusLabel(status)}</option>)}
          </DropdownSelect>
        </div>
      </div>

      {employeesState.loading && <LoadingState label="Загрузка сотрудников..." />}
      {employeesState.error && <ErrorState message={employeesState.error} onRetry={employeesState.reload} />}
      {!employeesState.loading && !employeesState.error && employeesState.employees.length === 0 && (
        <div className="text-sm text-muted">Нет сотрудников по текущему фильтру.</div>
      )}

      {!employeesState.loading && employeesState.employees.length > 0 && (
        <div className="space-y-2">
          {employeesState.employees.map((employee) => (
            <div key={employee.assignmentId} className="rounded-xl border border-subtle p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{employee.fullName}</div>
                  <div className="text-xs text-muted">
                    Попытки: {employee.attemptsUsed} / {employee.attemptsAllowed ?? "∞"} · Лучший балл: {employee.bestScore ?? "—"}%
                    {employee.attemptsAllowed != null && employee.attemptsUsed >= employee.attemptsAllowed && " · Лимит исчерпан"}
                  </div>
                </div>
                <CertificationStatusBadge status={employee.analyticsStatus} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onShowAttempts(employee.userId)}>История попыток</Button>
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" isLoading={managerActions.loadingActionKey === `grant:${employee.userId}`} onClick={() => void managerActions.grantEmployeeAttempt(employee.userId)}>
                      +1 попытка
                    </Button>
                    <Button size="sm" variant="outline" isLoading={managerActions.loadingActionKey === `reset:${employee.userId}`} onClick={() => void managerActions.resetEmployee(employee.userId)}>
                      Сбросить попытки
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Локальный parser: нужен только для UI select в этом компоненте.
function toStatusFilter(value: string): CertificationStatusFilter {
  return value === "ALL" || STATUS_OPTIONS.includes(value as CertificationAnalyticsStatus)
    ? (value as CertificationStatusFilter)
    : "ALL";
}
