import React from "react";

import type { ScheduleCellChangeOptions, ScheduleCellKey, EditableScheduleData } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";
import { parseTimeRangeValue } from "../utils/timeValues";

type UseScheduleCellEditingParams = {
  onScheduleChanged: React.Dispatch<React.SetStateAction<EditableScheduleData | null>>;
};

export default function useScheduleCellEditing({ onScheduleChanged }: UseScheduleCellEditingParams) {
  const changeCell = React.useCallback(
    (key: ScheduleCellKey, value: string, options?: ScheduleCellChangeOptions) => {
      onScheduleChanged((prev) => {
        if (!prev) return prev;
        const nextValues = { ...prev.cellValues };
        const nextSources = { ...(prev.cellSources ?? {}) };
        const nextShifts = { ...(prev.cellShifts ?? {}) };
        if (options?.commit) {
          const normalized = normalizeCellValue(value, prev.config.shiftMode);
          if (!normalized) {
            delete nextValues[key];
            delete nextSources[key];
            delete nextShifts[key];
          } else {
            nextValues[key] = normalized;
            nextSources[key] = options.source ?? "MANUAL";
            const { from, to } = parseTimeRangeValue(normalized);
            if (prev.config.shiftMode === "FULL" && from.hour !== null && to.hour !== null) {
              const startTime = `${String(from.hour).padStart(2, "0")}:${String(from.minute ?? 0).padStart(2, "0")}`;
              const endTime = `${String(to.hour).padStart(2, "0")}:${String(to.minute ?? 0).padStart(2, "0")}`;
              nextShifts[key] = {
                startTime,
                startDayOffset: 0,
                endTime,
                endDayOffset: endTime <= startTime ? 1 : 0,
              };
            } else {
              delete nextShifts[key];
            }
          }
        } else {
          nextValues[key] = value;
        }
        return { ...prev, cellValues: nextValues, cellSources: nextSources, cellShifts: nextShifts };
      });
    },
    [onScheduleChanged],
  );

  return { changeCell };
}
