import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import type { CertificationAssignmentStatus } from "../../api/types";
import type { useCertificationExamEmployees } from "../../hooks/certification/useCertificationExamEmployees";
import type { useCertificationManagerActions } from "../../hooks/certification/useCertificationManagerActions";
import { getCertificationAssignmentStatusLabel } from "../../utils/certificationAssignment";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import CertificationStatusBadge from "./CertificationStatusBadge";

type StatusFilter = "ALL" | CertificationAssignmentStatus;

type Props = {
  canManage: boolean;
  employeesState: ReturnType<typeof useCertificationExamEmployees>;
  managerActions: ReturnType<typeof useCertificationManagerActions>;
  statusFilter: StatusFilter;
  onStatusFilterChange: (next: StatusFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onShowAttempts: (userId: number | null) => void;
};

const STATUS_OPTIONS: CertificationAssignmentStatus[] = ["ASSIGNED", "IN_PROGRESS", "PASSED", "FAILED", "EXHAUSTED", "ARCHIVED"];

export default function CertificationEmployeesSection({
  canManage,
  employeesState,
  managerActions,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  onShowAttempts,
}: Props) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="text-sm font-semibold">Сотрудники</div>
        <div className="flex flex-wrap gap-2">
          <input className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Поиск по ФИО" />
          <select className="rounded-xl border border-subtle bg-surface px-3 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}>
            <option value="ALL">Все статусы</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{getCertificationAssignmentStatusLabel(status)}</option>)}
          </select>
        </div>
      </div>

      {employeesState.loading && <LoadingState label="Загрузка сотрудников..." />}
      {employeesState.error && <ErrorState message={employeesState.error} onRetry={employeesState.reload} />}

      {!employeesState.loading && employeesState.employees.length > 0 && (
        <div className="space-y-2">
          {employeesState.employees.map((employee) => (
            <div key={employee.assignmentId} className="rounded-xl border border-subtle p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{employee.fullName}</div>
                  <div className="text-xs text-muted">Попытки: {employee.attemptsUsed} / {employee.attemptsAllowed ?? "∞"} · Лучший балл: {employee.bestScore ?? "—"}%</div>
                </div>
                <CertificationStatusBadge status={employee.status} />
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
