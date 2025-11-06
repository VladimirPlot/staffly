import React from "react";

import type { ScheduleData, ScheduleCellKey, ShiftMode } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";

const PLACEHOLDERS: Record<ShiftMode, string> = {
  ARRIVAL_ONLY: "08 или 08:30",
  FULL: "08-14 или 08:30-12:30",
  NONE: "Свободный ввод",
};

type Props = {
  data: ScheduleData | null | undefined;
  onChange: (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => void;
};

const ScheduleTable: React.FC<Props> = ({ data, onChange }) => {
  if (!data) {
    return null;
  }

  const { days, rows, title, config } = data;

  const handleBlur = React.useCallback(
    (key: ScheduleCellKey, value: string) => {
      const normalized = normalizeCellValue(value, config.shiftMode);
      onChange(key, normalized, { commit: true });
    },
    [config.shiftMode, onChange]
  );

  const gridTemplateColumns = React.useMemo(() => {
    const dayColumns = days.map(() => "minmax(4rem, 1fr)").join(" ");
    return `minmax(14rem, max-content) ${dayColumns}`;
  }, [days]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border border-zinc-300 bg-white"
        style={{ gridTemplateColumns, minWidth: "100%" }}
      >
        <div className="flex items-center border-b border-zinc-300 px-4 py-3 font-semibold">
          {title}
        </div>
        {days.map((_, index) => (
          <div key={`title-${index}`} className="border-b border-l border-zinc-300" />
        ))}

        <div className="border-b border-zinc-200" />
        {days.map((day) => (
          <div
            key={`weekday-${day.date}`}
            className="flex items-center justify-center border-b border-l border-zinc-200 px-2 py-2 text-sm font-medium text-zinc-600"
          >
            {day.weekdayLabel}
          </div>
        ))}

        <div className="border-b border-zinc-200" />
        {days.map((day) => (
          <div
            key={`day-${day.date}`}
            className="flex items-center justify-center border-b border-l border-zinc-200 px-2 py-2 text-sm text-zinc-700"
          >
            {day.dayNumber}
          </div>
        ))}

        {rows.map((row) => (
          <React.Fragment key={row.member.id}>
            <div className="flex flex-col justify-center border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">
              <span>{row.displayName}</span>
              {row.positionName && (
                <span className="text-xs font-normal text-zinc-500">{row.positionName}</span>
              )}
            </div>
            {days.map((day) => {
              const key: ScheduleCellKey = `${row.member.id}:${day.date}`;
              const value = data.cellValues[key] ?? "";
              return (
                <div
                  key={key}
                  className="border-b border-l border-zinc-200 px-2 py-2 text-sm"
                >
                  <input
                    value={value}
                    onChange={(event) => onChange(key, event.target.value)}
                    onBlur={(event) => handleBlur(key, event.target.value)}
                    placeholder={PLACEHOLDERS[config.shiftMode]}
                    className="h-10 w-full rounded-xl border border-transparent bg-zinc-50 px-2 text-center text-sm text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none"
                  />
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ScheduleTable;
