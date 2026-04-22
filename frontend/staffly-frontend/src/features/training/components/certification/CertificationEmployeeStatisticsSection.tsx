import { Link } from "react-router-dom";
import type { PositionDto } from "../../../dictionaries/api";
import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import Input from "../../../../shared/ui/Input";
import SelectField from "../../../../shared/ui/SelectField";
import type { CertificationEmployeeSummaryDto } from "../../api/types";
import type { RestaurantRole } from "../../../../shared/types/restaurant";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import { trainingRoutes } from "../../utils/trainingRoutes";

type Props = {
  positions: PositionDto[];
  employees: CertificationEmployeeSummaryDto[];
  loading: boolean;
  error: string | null;
  positionsLoading: boolean;
  positionsError: string | null;
  allowedRoles: RestaurantRole[];
  positionFilter: number | null;
  search: string;
  hasFilters: boolean;
  returnTo: string;
  onPositionFilterChange: (value: number | null) => void;
  onSearchChange: (value: string) => void;
  onRetry: () => void;
  onRetryPositions: () => void;
};

export default function CertificationEmployeeStatisticsSection({
  positions,
  employees,
  loading,
  error,
  positionsLoading,
  positionsError,
  allowedRoles,
  positionFilter,
  search,
  hasFilters,
  returnTo,
  onPositionFilterChange,
  onSearchChange,
  onRetry,
  onRetryPositions,
}: Props) {
  const manageablePositions = positions.filter((position) => allowedRoles.includes(position.level));

  return (
    <section className="space-y-4 rounded-2xl border border-subtle bg-surface p-4">
      <h3 className="text-balance text-lg font-semibold">Статистика по сотрудникам</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Должность"
          value={positionFilter ?? ""}
          onChange={(event) => onPositionFilterChange(event.target.value === "" ? null : Number(event.target.value))}
        >
          <option value="">Все должности</option>
          {manageablePositions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </SelectField>

        <Input
          label="Поиск по ФИО"
          placeholder="Введите ФИО"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {positionsLoading && <LoadingState label="Загрузка должностей..." />}
      {positionsError && <ErrorState message={positionsError} onRetry={onRetryPositions} />}
      {loading && <LoadingState label="Загрузка сотрудников..." />}
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!positionsLoading && !positionsError && !loading && !error && !hasFilters && (
        <Card>
          <div className="text-sm text-muted">
            Укажите должность или начните вводить ФИО, чтобы посмотреть статистику по сотрудникам.
          </div>
        </Card>
      )}

      {!positionsLoading && !positionsError && !loading && !error && hasFilters && employees.length === 0 && (
        <Card>
          <div className="text-sm text-muted">По текущему фильтру сотрудники не найдены.</div>
        </Card>
      )}

      {!positionsLoading && !positionsError && !loading && !error && employees.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {employees.map((employee) => {
            const detailParams = new URLSearchParams({
              returnTo,
              fullName: employee.fullName,
              positionName: employee.positionName ?? "",
              assignedCount: String(employee.assignedCount),
              completedCount: String(employee.completedCount),
              passedCount: String(employee.passedCount),
              failedCount: String(employee.failedCount),
            });

            return (
              <Card key={employee.userId} className="space-y-3 p-4 sm:p-4">
                <div>
                  <div className="text-base font-semibold text-default">{employee.fullName}</div>
                  <div className="text-sm text-muted">{employee.positionName ?? "Должность не указана"}</div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted">
                  <div>Назначено: {employee.assignedCount}</div>
                  <div>Завершено: {employee.completedCount}</div>
                  <div>Сдано: {employee.passedCount}</div>
                  <div>Не сдано: {employee.failedCount}</div>
                </div>

                <div>
                  <Link to={`${trainingRoutes.employeeCertificationAnalytics(employee.userId)}?${detailParams.toString()}`}>
                    <Button size="sm" variant="outline">Подробнее</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
