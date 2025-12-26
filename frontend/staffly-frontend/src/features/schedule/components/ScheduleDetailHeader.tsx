import React from "react";

import Button from "../../../shared/ui/Button";
import { type ScheduleData } from "../types";

type ScheduleDetailHeaderProps = {
  schedule: ScheduleData;
  canManage: boolean;
  scheduleReadOnly: boolean;
  scheduleId: number | null;
  deleting: boolean;
  onEnterEditMode: () => void;
  onDelete: () => void;
  downloadMenuFor: number | null;
  onToggleDownloadMenu: (id: number | null) => void;
  downloading: { id: number; type: "xlsx" | "jpg" } | null;
  onDownloadXlsx: (id: number) => void;
  onDownloadJpg: (id: number) => void;
  canCreateShiftRequest: boolean;
  onOpenReplacement: () => void;
  onOpenSwap: () => void;
};

const ScheduleDetailHeader: React.FC<ScheduleDetailHeaderProps> = ({
  schedule,
  canManage,
  scheduleReadOnly,
  scheduleId,
  deleting,
  onEnterEditMode,
  onDelete,
  downloadMenuFor,
  onToggleDownloadMenu,
  downloading,
  onDownloadXlsx,
  onDownloadJpg,
  canCreateShiftRequest,
  onOpenReplacement,
  onOpenSwap,
}) => {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="text-xl font-semibold text-zinc-900">{schedule.title}</div>
        <div className="text-sm text-zinc-600">
          {schedule.config.startDate} — {schedule.config.endDate}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && scheduleReadOnly && scheduleId && (
          <>
            <Button variant="outline" onClick={onEnterEditMode} disabled={deleting}>
              Редактировать
            </Button>
            <Button
              variant="outline"
              onClick={onDelete}
              disabled={deleting}
              className={`border-red-200 text-red-600 hover:bg-red-50 ${
                deleting ? "cursor-wait opacity-60" : ""
              }`}
            >
              {deleting ? "Удаление…" : "Удалить"}
            </Button>
          </>
        )}

        {canManage && scheduleId && (
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => onToggleDownloadMenu(downloadMenuFor === scheduleId ? null : scheduleId)}
              disabled={Boolean(downloading)}
            >
              Скачать
            </Button>

            {downloadMenuFor === scheduleId && (
              <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-zinc-200 bg-white shadow-lg">
                <button
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  onClick={() => {
                    onDownloadXlsx(scheduleId);
                    onToggleDownloadMenu(null);
                  }}
                >
                  Скачать .xlsx
                </button>
                <button
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  onClick={() => {
                    onDownloadJpg(scheduleId);
                    onToggleDownloadMenu(null);
                  }}
                >
                  Скачать .jpg
                </button>
              </div>
            )}
          </div>
        )}

        {!canManage && canCreateShiftRequest && (
          <>
            <Button variant="outline" onClick={onOpenReplacement}>
              Создать замену
            </Button>
            <Button variant="outline" onClick={onOpenSwap}>
              Создать обмен сменами
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleDetailHeader;
