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
  readOnly?: boolean;
};

const ScheduleTable: React.FC<Props> = ({ data, onChange, readOnly = false }) => {
  if (!data) {
    return null;
  }

  const { days, rows, title, config } = data;

  const handleBlur = React.useCallback(
    (key: ScheduleCellKey, value: string) => {
      if (readOnly) return;
      const normalized = normalizeCellValue(value, config.shiftMode);
      onChange(key, normalized, { commit: true });
    },
    [config.shiftMode, onChange, readOnly]
  );

  const gridTemplateColumns = React.useMemo(() => {
    const dayColumns = days.map(() => "minmax(4rem, 1fr)").join(" ");
    return `max-content ${dayColumns}`;
  }, [days]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border border-zinc-300 bg-white"
        style={{ gridTemplateColumns, minWidth: "100%" }}
      >
        <div
          className="flex items-center justify-center border-b border-zinc-300 px-4 py-3 text-center font-semibold"
          style={{ gridColumn: `1 / span ${days.length + 1}` }}
        >
          {title}
        </div>

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

        {rows.map((row, rowIndex) => {
          const rowKey = row.id ?? row.memberId ?? rowIndex;
          return (
            <React.Fragment key={rowKey}>
              <div className="flex flex-col justify-center border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">
                <span>{row.displayName}</span>
                {row.positionName && (
                  <span className="text-xs font-normal text-zinc-500">{row.positionName}</span>
                )}
              </div>
              {days.map((day) => {
                const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
                const value = data.cellValues[key] ?? "";
                return (
                  <div
                    key={key}
                    className="border-b border-l border-zinc-200 px-2 py-2 text-sm"
                  >
                    {readOnly ? (
                      <div className="flex min-h-[2.5rem] items-center justify-center rounded-xl bg-white px-2 text-center text-sm text-zinc-800">
                        {value || "\u00A0"}
                      </div>
                    ) : (
                      <input
                        value={value}
                        onChange={(event) => onChange(key, event.target.value)}
                        onBlur={(event) => handleBlur(key, event.target.value)}
                        placeholder={PLACEHOLDERS[config.shiftMode]}
                        className="h-10 w-full rounded-xl border border-transparent bg-zinc-50 px-2 text-center text-sm text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleTable;
