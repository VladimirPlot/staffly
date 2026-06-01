import React from "react";

import type { ScheduleCellChangeOptions, ScheduleCellKey, ScheduleData } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";

type UseScheduleCellEditingParams = {
  onScheduleChanged: React.Dispatch<React.SetStateAction<ScheduleData | null>>;
};

export default function useScheduleCellEditing({ onScheduleChanged }: UseScheduleCellEditingParams) {
  const changeCell = React.useCallback(
    (key: ScheduleCellKey, value: string, options?: ScheduleCellChangeOptions) => {
      onScheduleChanged((prev) => {
        if (!prev) return prev;
        const nextValues = { ...prev.cellValues };
        const nextSources = { ...(prev.cellSources ?? {}) };
        if (options?.commit) {
          const normalized = normalizeCellValue(value, prev.config.shiftMode);
          if (!normalized) {
            delete nextValues[key];
            delete nextSources[key];
          } else {
            nextValues[key] = normalized;
            nextSources[key] = options.source ?? "MANUAL";
          }
        } else {
          nextValues[key] = value;
        }
        return { ...prev, cellValues: nextValues, cellSources: nextSources };
      });
    },
    [onScheduleChanged],
  );

  return { changeCell };
}
