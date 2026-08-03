import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ScheduleTable from "./ScheduleTable";
import { useScheduleTableZoom } from "../hooks/useScheduleTableZoom";
import {
  type ScheduleData,
  type ScheduleCellChangeOptions,
  type ScheduleCellKey,
  type SchedulePreferenceHintsByCellKey,
  type ScheduleRejectionHintsByCellKey,
} from "../types";
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
  showAddMember: boolean;
  addMemberLoading: boolean;
  onOpenAddMember: () => void;
  onCellChange: (key: ScheduleCellKey, value: string, options?: ScheduleCellChangeOptions) => void;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
  preferenceCommentsByMemberId?: Record<number, string>;
  rejectionHintsByCellKey?: ScheduleRejectionHintsByCellKey;
  showCellDiagnostics?: boolean;
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
  showAddMember,
  addMemberLoading,
  onOpenAddMember,
  onCellChange,
  preferenceHintsByCellKey,
  preferenceCommentsByMemberId,
  rejectionHintsByCellKey,
  showCellDiagnostics = false,
}) => {
  const showControls = canManage && schedule && !scheduleReadOnly && !loading && !error && !scheduleLoading;
  const showTableZoomControls = schedule.rows.length > 0 && !loading && !error && !scheduleLoading;
  const { zoom, zoomScale, isDefaultZoom, minZoom, maxZoom, zoomStep, setZoom, showFullPeriod, resetZoom } =
    useScheduleTableZoom({
      readOnly: scheduleReadOnly,
    });
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
          {scheduleId && showAddMember && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenAddMember}
              disabled={saveDisabled || addMemberLoading}
            >
              {addMemberLoading ? "Загрузка…" : "Добавить сотрудника"}
            </Button>
          )}
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
          {scheduleId && (
            <Button onClick={onSave} disabled={saveDisabled} className={saving ? "cursor-wait opacity-70" : ""}>
              {saving ? "Сохранение…" : "Сохранить изменения"}
            </Button>
          )}
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

        {showTableZoomControls && (
          <div className="border-subtle bg-app mb-3 rounded-2xl border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-strong shrink-0 text-sm font-medium">Масштаб</span>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={isDefaultZoom ? showFullPeriod : resetZoom}>
                  {isDefaultZoom ? "Показать весь период" : "Обычный вид"}
                </Button>
                <div className="flex w-full max-w-[18rem] min-w-[12rem] items-center gap-2 sm:w-[16rem] lg:w-[18rem]">
                  <input
                    type="range"
                    min={minZoom}
                    max={maxZoom}
                    step={zoomStep}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="min-w-0 flex-1 accent-[var(--staffly-text-strong)]"
                    aria-label="Масштаб таблицы"
                  />
                  <span className="text-strong w-10 shrink-0 text-right text-xs tabular-nums">{zoom}%</span>
                </div>
              </div>
            </div>
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
                preferenceHintsByCellKey={showCellDiagnostics ? preferenceHintsByCellKey : undefined}
                preferenceCommentsByMemberId={showCellDiagnostics ? preferenceCommentsByMemberId : undefined}
                rejectionHintsByCellKey={showCellDiagnostics ? rejectionHintsByCellKey : undefined}
                showCellDiagnostics={showCellDiagnostics}
                zoomScale={zoomScale}
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
