import React from "react";

import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import type { ScheduleBuildTemplateDto } from "../api";
import type { ScheduleCellKey, ScheduleData, SchedulePreferenceHintsByCellKey } from "../types";
import { hasNegativePreferenceConflict } from "../utils/preferenceHints";
import { hasStartWithoutEndValue } from "../utils/timeValues";

type PublishScheduleConfirmDialogProps = {
  open: boolean;
  schedule: ScheduleData | null;
  buildTemplate?: ScheduleBuildTemplateDto | null;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
  publishing: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

type PublishSummary = {
  totalRows: number;
  totalDays: number;
  filledCellsCount: number;
  plannedShiftsCount: number;
  unfilledByPlan: number;
  incompleteFullShiftCount: number;
  negativeConflictCount: number;
};

const EMPTY_SUMMARY: PublishSummary = {
  totalRows: 0,
  totalDays: 0,
  filledCellsCount: 0,
  plannedShiftsCount: 0,
  unfilledByPlan: 0,
  incompleteFullShiftCount: 0,
  negativeConflictCount: 0,
};

const SummaryCounter: React.FC<{ label: string; value: number; tone?: "default" | "warning" }> = ({
  label,
  value,
  tone = "default",
}) => (
  <div
    className={`rounded-xl border px-3 py-2 ${
      tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-subtle bg-card text-default"
    }`}
  >
    <div className="text-muted text-xs">{label}</div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

const WarningBox: React.FC<{ children: React.ReactNode; high?: boolean }> = ({ children, high = false }) => (
  <div
    className={`rounded-xl border px-3 py-2 text-sm ${
      high ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
    }`}
  >
    {children}
  </div>
);

function getPublishSummary(
  schedule: ScheduleData | null,
  buildTemplate?: ScheduleBuildTemplateDto | null,
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey,
): PublishSummary {
  if (!schedule) return EMPTY_SUMMARY;

  const totalRows = schedule.rows.length;
  const totalDays = schedule.days.length;
  let filledCellsCount = 0;
  let incompleteFullShiftCount = 0;
  let negativeConflictCount = 0;

  schedule.rows.forEach((row) => {
    schedule.days.forEach((day) => {
      const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
      const value = schedule.cellValues[key] ?? "";
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      filledCellsCount += 1;

      if (schedule.config.shiftMode === "FULL" && hasStartWithoutEndValue(value)) {
        incompleteFullShiftCount += 1;
      }

      const hints = preferenceHintsByCellKey?.[key] ?? [];
      if (
        hints.length > 0 &&
        hasNegativePreferenceConflict({
          value,
          hints,
          shiftMode: schedule.config.shiftMode,
        })
      ) {
        negativeConflictCount += 1;
      }
    });
  });

  const schedulePositionIds = new Set(schedule.config.positionIds);
  const relevantPositionConfigs =
    buildTemplate?.positionConfigs.filter((config) =>
      config.positionIds.some((positionId) => schedulePositionIds.has(positionId)),
    ) ?? [];
  const hasReliablePlan = buildTemplate != null;
  const plannedShiftsCount = hasReliablePlan
    ? schedule.days.reduce((total, day) => {
        const jsDayOfWeek = new Date(`${day.date}T00:00:00Z`).getUTCDay();
        const dayOfWeek = jsDayOfWeek === 0 ? 7 : jsDayOfWeek;

        return (
          total +
          relevantPositionConfigs.reduce((dateTotal, config) => {
            const dateOverrides = config.coverageDateOverrides.filter((override) => override.date === day.date);
            const requiredCounts =
              dateOverrides.length > 0
                ? dateOverrides.map((override) => override.requiredCount)
                : config.coverageRules.filter((rule) => rule.dayOfWeek === dayOfWeek).map((rule) => rule.requiredCount);

            return dateTotal + requiredCounts.reduce((sum, count) => sum + Math.max(0, count), 0);
          }, 0)
        );
      }, 0)
    : filledCellsCount;
  const unfilledByPlan = hasReliablePlan ? Math.max(0, plannedShiftsCount - filledCellsCount) : 0;

  return {
    totalRows,
    totalDays,
    filledCellsCount,
    plannedShiftsCount,
    unfilledByPlan,
    incompleteFullShiftCount,
    negativeConflictCount,
  };
}

const PublishScheduleConfirmDialog: React.FC<PublishScheduleConfirmDialogProps> = ({
  open,
  schedule,
  buildTemplate,
  preferenceHintsByCellKey,
  publishing,
  onClose,
  onConfirm,
}) => {
  const summary = React.useMemo(
    () => getPublishSummary(schedule, buildTemplate, preferenceHintsByCellKey),
    [buildTemplate, preferenceHintsByCellKey, schedule],
  );

  const handleClose = React.useCallback(() => {
    if (publishing) return;
    onClose();
  }, [onClose, publishing]);

  const publishDisabled = publishing || summary.incompleteFullShiftCount > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Опубликовать график?"
      description="После публикации сотрудники увидят график и смогут создавать заявки на замену/обмен сменами."
      className="max-w-xl"
      footer={
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="outline" onClick={handleClose} disabled={publishing} className="w-full sm:w-auto">
            Отмена
          </Button>
          <Button onClick={onConfirm} disabled={publishDisabled} className="w-full sm:w-auto">
            {publishing ? "Публикация…" : "Опубликовать"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="border-subtle bg-app rounded-2xl border p-4">
          <h3 className="text-default text-sm font-semibold">Сводка перед публикацией</h3>
          <div className="text-muted mt-2 text-sm">
            Период: {schedule?.config.startDate ?? "—"} — {schedule?.config.endDate ?? "—"}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
            <SummaryCounter label="Сотрудников" value={summary.totalRows} />
            <SummaryCounter label="Дней" value={summary.totalDays} />
            <SummaryCounter label="Планировали смен" value={summary.plannedShiftsCount} />
            <SummaryCounter label="Заполнено смен" value={summary.filledCellsCount} />
            <SummaryCounter
              label="Не закрыто"
              value={summary.unfilledByPlan}
              tone={summary.unfilledByPlan > 0 ? "warning" : "default"}
            />
          </div>
        </section>

        {(summary.incompleteFullShiftCount > 0 || summary.negativeConflictCount > 0 || summary.unfilledByPlan > 0) && (
          <section className="space-y-2">
            <h3 className="text-default text-sm font-semibold">Предупреждения</h3>
            {summary.incompleteFullShiftCount > 0 && (
              <WarningBox high>
                Есть незавершённые смены: {summary.incompleteFullShiftCount}. Например, указано начало без окончания.
              </WarningBox>
            )}
            {summary.unfilledByPlan > 0 && (
              <WarningBox>
                Не закрыто смен по плану: {summary.unfilledByPlan}. Проверьте, это осознанное решение или пропущенное
                назначение.
              </WarningBox>
            )}
            {summary.negativeConflictCount > 0 && (
              <WarningBox>
                {summary.negativeConflictCount} смен конфликтуют с отрицательными пожеланиями сотрудников. Проверьте эти
                смены перед публикацией.
              </WarningBox>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
};

export default PublishScheduleConfirmDialog;
