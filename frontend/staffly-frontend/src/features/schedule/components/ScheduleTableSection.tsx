import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ScheduleTable from "./ScheduleTable";
import { type ScheduleData, type ScheduleCellKey, type SchedulePreferenceHintsByCellKey } from "../types";

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
