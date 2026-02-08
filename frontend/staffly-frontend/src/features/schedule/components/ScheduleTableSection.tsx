import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ScheduleTable from "./ScheduleTable";
import { type ScheduleData, type ScheduleCellKey } from "../types";

type ScheduleTableSectionProps = {
  schedule: ScheduleData;
  scheduleReadOnly: boolean;
  scheduleId: number | null;
  saving: boolean;
  monthFallback: string | null;
  canManage: boolean;
  loading: boolean;
  error: string | null;
  scheduleLoading: boolean;
  onCancelEdit: () => void;
  onSave: () => void;
  onCellChange: (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => void;
};

const ScheduleTableSection: React.FC<ScheduleTableSectionProps> = ({
  schedule,
  scheduleReadOnly,
  scheduleId,
  saving,
  monthFallback,
  canManage,
  loading,
  error,
  scheduleLoading,
  onCancelEdit,
  onSave,
  onCellChange,
}) => {
  const showControls =
    canManage && schedule && !scheduleReadOnly && !loading && !error && !scheduleLoading;

  return (
    <>
      {showControls && (
        <div className="flex flex-wrap justify-end gap-2">
          {scheduleId && (
            <Button
              variant="ghost"
              onClick={onCancelEdit}
              disabled={saving}
              className={saving ? "cursor-not-allowed opacity-60" : ""}
            >
              Отменить
            </Button>
          )}
          <Button onClick={onSave} disabled={saving} className={saving ? "cursor-wait opacity-70" : ""}>
            {saving ? "Сохранение…" : scheduleId ? "Сохранить изменения" : "Сохранить график"}
          </Button>
        </div>
      )}

      <Card className="overflow-visible">
        {scheduleReadOnly && (
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Просмотр сохранённого графика
          </div>
        )}

        {schedule.rows.length === 0 ? (
          <div className="text-sm text-muted">
            В выбранных должностях пока нет сотрудников. Попробуйте выбрать другие должности.
          </div>
        ) : (
          <div className="-mx-6 max-h-[70vh] overflow-auto [webkit-overflow-scrolling:touch]">
            <div className="inline-block min-w-full px-6 align-top">
              <ScheduleTable
                data={schedule}
                onChange={onCellChange}
                readOnly={scheduleReadOnly}
              />
            </div>
          </div>
        )}

        {schedule.rows.length > 0 && monthFallback && (
          <div className="mt-3 text-xs text-muted">
            Период: {schedule.config.startDate} — {schedule.config.endDate} ({monthFallback})
          </div>
        )}
      </Card>
    </>
  );
};

export default ScheduleTableSection;
