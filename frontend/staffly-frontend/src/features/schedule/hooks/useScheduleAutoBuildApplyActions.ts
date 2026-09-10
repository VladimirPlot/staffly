import React from "react";

import {
  applyScheduleAutoBuild,
  listSavedSchedules,
  type AdjustedScheduleAutoBuildAssignment,
  type ScheduleSummary,
} from "../api";
import type { ScheduleData } from "../types";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type ScheduleRange = { start: string; end: string } | null;

type UseScheduleAutoBuildApplyActionsParams = {
  restaurantId: number | null;
  scheduleId: number | null;
  scheduleVersion: number | null;
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  onScheduleChanged: (schedule: ScheduleData | null) => void;
  onSavedSchedulesChanged: (items: ScheduleSummary[]) => void;
  onScheduleReadOnlyChanged: (value: boolean) => void;
  onLastRangeChanged: (value: ScheduleRange) => void;
  onClearScheduleNotices: () => void;
  onScheduleMessage: (message: string) => void;
  onScheduleError: (message: string | null) => void;
  onPreviewStale: () => void;
};

export default function useScheduleAutoBuildApplyActions({
  restaurantId,
  scheduleId,
  scheduleVersion,
  prepareSchedule,
  onScheduleChanged,
  onSavedSchedulesChanged,
  onScheduleReadOnlyChanged,
  onLastRangeChanged,
  onClearScheduleNotices,
  onScheduleMessage,
  onScheduleError,
  onPreviewStale,
}: UseScheduleAutoBuildApplyActionsParams) {
  const [applying, setApplying] = React.useState(false);
  const activeScheduleIdRef = React.useRef(scheduleId);
  activeScheduleIdRef.current = scheduleId;

  const applyAutoBuild = React.useCallback(
    async (
      templateId: number,
      previewToken: string,
      adjustedAssignments?: AdjustedScheduleAutoBuildAssignment[],
    ): Promise<boolean> => {
      if (!restaurantId || !scheduleId || scheduleVersion == null || !templateId || !previewToken) return false;
      setApplying(true);
      onClearScheduleNotices();
      try {
        const updated = await applyScheduleAutoBuild(restaurantId, scheduleId, {
          version: scheduleVersion,
          templateId,
          previewToken,
          adjustedAssignments,
        });
        if (updated.id !== activeScheduleIdRef.current) return false;
        const prepared = prepareSchedule(updated);
        onScheduleChanged(prepared);
        onScheduleReadOnlyChanged(true);
        onLastRangeChanged({ start: prepared.config.startDate, end: prepared.config.endDate });

        const savedList = await listSavedSchedules(restaurantId);
        onSavedSchedulesChanged(savedList);

        onScheduleMessage("Автосборка применена. Проверьте черновик и при необходимости отредактируйте смены вручную.");
        return true;
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e != null &&
          (e as { response?: { data?: { error?: unknown } } }).response?.data?.error === "AUTO_BUILD_PREVIEW_STALE"
        ) {
          onPreviewStale();
        }
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
      onPreviewStale,
      onScheduleMessage,
      onScheduleReadOnlyChanged,
      prepareSchedule,
      restaurantId,
      scheduleId,
      scheduleVersion,
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
