import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ScheduleTable from "./ScheduleTable";
import { type ScheduleData, type ScheduleCellKey, type SchedulePreferenceHintsByCellKey } from "../types";
import { hasNegativePreferenceConflict } from "../utils/preferenceHints";

type ScheduleTableSectionProps = {
  schedule: ScheduleData;
  scheduleReadOnly: boolean;
  scheduleId: number | null;
  saving: boolean;
  savingDraft: boolean;
  monthFallback: string | null;
  canManage: boolean;
  loading: boolean;
  error: string | null;
  scheduleLoading: boolean;
  onCancelEdit: () => void;
  onSave: () => void;
  onSaveDraft: () => void;
  onCellChange: (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => void;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
};

const ScheduleTableSection: React.FC<ScheduleTableSectionProps> = ({
  schedule,
  scheduleReadOnly,
  scheduleId,
  saving,
  savingDraft,
  monthFallback,
  canManage,
  loading,
  error,
  scheduleLoading,
  onCancelEdit,
  onSave,
  onSaveDraft,
  onCellChange,
  preferenceHintsByCellKey,
}) => {
  const showControls = canManage && schedule && !scheduleReadOnly && !loading && !error && !scheduleLoading;
  const saveDisabled = saving || savingDraft;
  const showDraftFromPreferencesNotice = canManage && schedule.status === "DRAFT_FROM_PREFERENCES";
  const reviewSummary = React.useMemo(() => {
    if (!showDraftFromPreferencesNotice) {
      return null;
    }

    let filledCellsCount = 0;
    let negativeConflictCount = 0;
    let emptyCellsWithHintsCount = 0;

    schedule.rows.forEach((row) => {
      schedule.days.forEach((day) => {
        const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
        const value = schedule.cellValues[key] ?? "";
        const hasValue = value.trim().length > 0;
        const hints = preferenceHintsByCellKey?.[key] ?? [];

        if (hasValue) {
          filledCellsCount += 1;
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
          return;
        }

        if (hints.length > 0) {
          emptyCellsWithHintsCount += 1;
        }
      });
    });

    return { filledCellsCount, negativeConflictCount, emptyCellsWithHintsCount };
  }, [preferenceHintsByCellKey, schedule, showDraftFromPreferencesNotice]);

  return (
    <>
      {showControls && (
        <div className="flex flex-wrap justify-end gap-2">
          {scheduleId && (
            <Button
              variant="ghost"
              onClick={onCancelEdit}
              disabled={saveDisabled}
              className={saveDisabled ? "cursor-not-allowed opacity-60" : ""}
            >
              Отменить
            </Button>
          )}
          {!scheduleId && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={saveDisabled}
              className={savingDraft ? "cursor-wait opacity-70" : ""}
            >
              {savingDraft ? "Сохранение…" : "Сохранить черновик"}
            </Button>
          )}
          <Button onClick={onSave} disabled={saveDisabled} className={saving ? "cursor-wait opacity-70" : ""}>
            {saving ? "Сохранение…" : scheduleId ? "Сохранить изменения" : "Сохранить график"}
          </Button>
        </div>
      )}

      <Card className="overflow-visible">
        {showDraftFromPreferencesNotice && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">
              Это черновик после применения пожеланий/автосборки. Проверьте смены, предупреждения и при необходимости
              отредактируйте часы вручную перед публикацией.
            </p>
            <p className="mt-1 text-xs">
              {scheduleReadOnly
                ? "Чтобы внести изменения, нажмите «Редактировать»."
                : "После проверки сохраните изменения, затем опубликуйте график."}
            </p>
            {reviewSummary && (
              <p className="mt-1 text-xs">
                Заполнено ячеек: {reviewSummary.filledCellsCount}. Конфликтов с пожеланиями:{" "}
                {reviewSummary.negativeConflictCount}. Пустых ячеек с пожеланиями:{" "}
                {reviewSummary.emptyCellsWithHintsCount}.
              </p>
            )}
          </div>
        )}

        {scheduleReadOnly && (
          <div className="text-muted mb-3 text-xs font-medium tracking-wide uppercase">
            Просмотр сохранённого графика
          </div>
        )}

        {schedule.rows.length === 0 ? (
          <div className="text-muted text-sm">
            В выбранных должностях пока нет сотрудников. Попробуйте выбрать другие должности.
          </div>
        ) : (
          <div className="-mx-6 max-h-[70vh] overflow-auto [webkit-overflow-scrolling:touch]">
            <div className="inline-block min-w-full px-6 align-top">
              <ScheduleTable
                data={schedule}
                onChange={onCellChange}
                readOnly={scheduleReadOnly}
                preferenceHintsByCellKey={preferenceHintsByCellKey}
              />
            </div>
          </div>
        )}

        {schedule.rows.length > 0 && monthFallback && (
          <div className="text-muted mt-3 text-xs">
            Период: {schedule.config.startDate} — {schedule.config.endDate} ({monthFallback})
          </div>
        )}
      </Card>
    </>
  );
};

export default ScheduleTableSection;
