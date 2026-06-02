import React from "react";

import { applyScheduleAutoBuild, listSavedSchedules, type ScheduleSummary } from "../api";
import type { ScheduleData } from "../types";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type ScheduleRange = { start: string; end: string } | null;

type UseScheduleAutoBuildApplyActionsParams = {
  restaurantId: number | null;
  scheduleId: number | null;
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  onScheduleChanged: (schedule: ScheduleData | null) => void;
  onSavedSchedulesChanged: (items: ScheduleSummary[]) => void;
  onScheduleReadOnlyChanged: (value: boolean) => void;
  onLastRangeChanged: (value: ScheduleRange) => void;
  onClearScheduleNotices: () => void;
  onScheduleMessage: (message: string) => void;
  onScheduleError: (message: string | null) => void;
};

export default function useScheduleAutoBuildApplyActions({
  restaurantId,
  scheduleId,
  prepareSchedule,
  onScheduleChanged,
  onSavedSchedulesChanged,
  onScheduleReadOnlyChanged,
  onLastRangeChanged,
  onClearScheduleNotices,
  onScheduleMessage,
  onScheduleError,
}: UseScheduleAutoBuildApplyActionsParams) {
  const [applying, setApplying] = React.useState(false);

  const applyAutoBuild = React.useCallback(
    async (templateId: number): Promise<boolean> => {
      if (!restaurantId || !scheduleId || !templateId) return false;
      setApplying(true);
      onClearScheduleNotices();
      try {
        const updated = await applyScheduleAutoBuild(restaurantId, scheduleId, { templateId });
        const prepared = prepareSchedule(updated);
        onScheduleChanged(prepared);
        onScheduleReadOnlyChanged(true);
        onLastRangeChanged({ start: prepared.config.startDate, end: prepared.config.endDate });

        const savedList = await listSavedSchedules(restaurantId);
        onSavedSchedulesChanged(savedList);

        onScheduleMessage("Автосборка применена. Проверьте черновик и при необходимости отредактируйте смены вручную.");
        return true;
      } catch (e: unknown) {
        onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось применить автосборку"));
        return false;
      } finally {
        setApplying(false);
      }
    },
    [
      onClearScheduleNotices,
      onLastRangeChanged,
      onSavedSchedulesChanged,
      onScheduleChanged,
      onScheduleError,
      onScheduleMessage,
      onScheduleReadOnlyChanged,
      prepareSchedule,
      restaurantId,
      scheduleId,
    ],
  );

  return React.useMemo(
    () => ({
      applying,
      applyAutoBuild,
    }),
    [applying, applyAutoBuild],
  );
}
