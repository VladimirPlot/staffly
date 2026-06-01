import React from "react";

import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import type { ScheduleCellKey, ScheduleData, SchedulePreferenceHintsByCellKey } from "../types";
import { hasNegativePreferenceConflict } from "../utils/preferenceHints";
import { hasStartWithoutEndValue } from "../utils/timeValues";

type PublishScheduleConfirmDialogProps = {
  open: boolean;
  schedule: ScheduleData | null;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
  publishing: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

type PublishSummary = {
  totalRows: number;
  totalDays: number;
  filledCellsCount: number;
  emptyCellsCount: number;
  manualCount: number;
  preferenceHintCount: number;
  autoBuildCount: number;
  incompleteFullShiftCount: number;
  negativeConflictCount: number;
};

const EMPTY_SUMMARY: PublishSummary = {
  totalRows: 0,
  totalDays: 0,
  filledCellsCount: 0,
  emptyCellsCount: 0,
  manualCount: 0,
  preferenceHintCount: 0,
  autoBuildCount: 0,
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
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey,
): PublishSummary {
  if (!schedule) return EMPTY_SUMMARY;

  const totalRows = schedule.rows.length;
  const totalDays = schedule.days.length;
  const totalCellsCount = totalRows * totalDays;
  let filledCellsCount = 0;
  let manualCount = 0;
  let preferenceHintCount = 0;
  let autoBuildCount = 0;
  let incompleteFullShiftCount = 0;
  let negativeConflictCount = 0;

  schedule.rows.forEach((row) => {
    schedule.days.forEach((day) => {
      const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
      const value = schedule.cellValues[key] ?? "";
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      filledCellsCount += 1;

      const source = schedule.cellSources?.[key];
      if (source === "PREFERENCE_HINT") {
        preferenceHintCount += 1;
      } else if (source === "AUTO_BUILD") {
        autoBuildCount += 1;
      } else {
        manualCount += 1;
      }

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

  return {
    totalRows,
    totalDays,
    filledCellsCount,
    emptyCellsCount: totalCellsCount - filledCellsCount,
    manualCount,
    preferenceHintCount,
    autoBuildCount,
    incompleteFullShiftCount,
    negativeConflictCount,
  };
}

const PublishScheduleConfirmDialog: React.FC<PublishScheduleConfirmDialogProps> = ({
  open,
  schedule,
  preferenceHintsByCellKey,
  publishing,
  onClose,
  onConfirm,
}) => {
  const summary = React.useMemo(
    () => getPublishSummary(schedule, preferenceHintsByCellKey),
    [preferenceHintsByCellKey, schedule],
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
            <SummaryCounter label="Заполнено смен" value={summary.filledCellsCount} />
            <SummaryCounter label="Пустых ячеек" value={summary.emptyCellsCount} tone="warning" />
            <SummaryCounter label="Автосборка" value={summary.autoBuildCount} />
            <SummaryCounter label="Из пожеланий" value={summary.preferenceHintCount} />
            <SummaryCounter label="Ручные правки" value={summary.manualCount} />
          </div>
        </section>

        {(summary.incompleteFullShiftCount > 0 ||
          summary.negativeConflictCount > 0 ||
          summary.emptyCellsCount > 0 ||
          summary.filledCellsCount === 0) && (
          <section className="space-y-2">
            <h3 className="text-default text-sm font-semibold">Предупреждения</h3>
            {summary.incompleteFullShiftCount > 0 && (
              <WarningBox high>
                Есть незавершённые смены: {summary.incompleteFullShiftCount}. Например, указано начало без окончания.
              </WarningBox>
            )}
            {summary.negativeConflictCount > 0 && (
              <WarningBox>Есть конфликты с отрицательными пожеланиями: {summary.negativeConflictCount}.</WarningBox>
            )}
            {summary.emptyCellsCount > 0 && (
              <WarningBox>
                Есть пустые ячейки: {summary.emptyCellsCount}. Это нормально, если сотрудник не должен работать в эти
                дни.
              </WarningBox>
            )}
            {summary.filledCellsCount === 0 && <WarningBox>В графике нет заполненных смен.</WarningBox>}
          </section>
        )}
      </div>
    </Modal>
  );
};

export default PublishScheduleConfirmDialog;
