import React from "react";

import type { ScheduleCellKey, ScheduleData } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";

type UseScheduleCellEditingParams = {
  onScheduleChanged: React.Dispatch<React.SetStateAction<ScheduleData | null>>;
};

export default function useScheduleCellEditing({ onScheduleChanged }: UseScheduleCellEditingParams) {
  const changeCell = React.useCallback(
    (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => {
      onScheduleChanged((prev) => {
        if (!prev) return prev;
        const nextValues = { ...prev.cellValues };
        if (options?.commit) {
          const normalized = normalizeCellValue(value, prev.config.shiftMode);
          if (!normalized) {
            delete nextValues[key];
          } else {
            nextValues[key] = normalized;
          }
        } else {
          nextValues[key] = value;
        }
        return { ...prev, cellValues: nextValues };
      });
    },
    [onScheduleChanged],
  );

  return { changeCell };
}
