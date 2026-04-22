import { Link } from "react-router-dom";
import type { PositionDto } from "../../../dictionaries/api";
import Button from "../../../../shared/ui/Button";
import Card from "../../../../shared/ui/Card";
import Input from "../../../../shared/ui/Input";
import SelectField from "../../../../shared/ui/SelectField";
import type { CertificationEmployeeSummaryDto } from "../../api/types";
import type { RestaurantRole } from "../../../../shared/types/restaurant";
import { withReturnToParam } from "../../utils/returnTo";
import { trainingRoutes } from "../../utils/trainingRoutes";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import CertificationCompletionProgress from "./CertificationCompletionProgress";

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

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-app px-3 py-1.5 text-xs text-muted">
      <span>{label}: </span>
      <span className="font-medium text-default">{value}</span>
    </div>
  );
}

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
  const manageablePositions = positions.filter((position) =>
    allowedRoles.includes(position.level),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-subtle bg-surface p-4">
      <h3 className="text-balance text-lg font-semibold">
        Статистика по сотрудникам
      </h3>

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Должность"
          value={positionFilter ?? ""}
          onChange={(event) =>
            onPositionFilterChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        >
          <option value="">Выберите должность</option>
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
      {positionsError && (
        <ErrorState message={positionsError} onRetry={onRetryPositions} />
      )}
      {loading && <LoadingState label="Загрузка сотрудников..." />}
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!positionsLoading && !positionsError && !loading && !error && !hasFilters && (
        <Card>
          <div className="text-sm text-muted">
            Укажите должность или начните вводить ФИО, чтобы посмотреть
            статистику по сотрудникам.
          </div>
        </Card>
      )}

      {!positionsLoading &&
        !positionsError &&
        !loading &&
        !error &&
        hasFilters &&
        employees.length === 0 && (
          <Card>
            <div className="text-sm text-muted">
              По текущему фильтру сотрудники не найдены.
            </div>
          </Card>
        )}

      {!positionsLoading &&
        !positionsError &&
        !loading &&
        !error &&
        employees.length > 0 && (
          <div className="space-y-3">
            {employees.map((employee) => {
              const detailHref = withReturnToParam(
                trainingRoutes.employeeCertificationAnalytics(employee.userId),
                returnTo,
              );

              return (
                <div
                  key={employee.userId}
                  className="group relative rounded-2xl border border-subtle bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--staffly-border)] hover:shadow-md sm:p-5"
                >
                  <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-3">
                    <Link to={detailHref}>
                      <Button size="sm" variant="outline">
                        Подробнее
                      </Button>
                    </Link>

                    <div className="flex w-[132px] flex-col gap-1">
                      <MetricPill label="Сдали" value={employee.passedCount} />
                      <MetricPill label="Не сдали" value={employee.failedCount} />
                    </div>
                  </div>

                  <div className="pr-40">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-default break-words transition-colors duration-200 group-hover:text-strong sm:text-lg">
                            {employee.fullName}
                          </h4>
                        </div>

                        <div className="mt-2 text-sm text-muted break-words">
                          {employee.positionName ?? "Должность не указана"}
                        </div>

                        <div className="mt-1 text-sm text-muted">
                          Назначено: {employee.assignedCount} · Завершено:{" "}
                          {employee.completedCount}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:gap-4">
                        <CertificationCompletionProgress
                          completed={employee.completedCount}
                          assigned={employee.assignedCount}
                          size={104}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </section>
  );
}
