import React from "react";

import type { ScheduleData, ScheduleCellKey, ShiftMode } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";

type TimeValue = {
  hour: number | null;
  minute: number | null;
};

const HOURS = Array.from({ length: 25 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45];

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

type EditableCellProps = {
  value: string;
  shiftMode: ShiftMode;
  placeholder: string;
  onInputChange: (value: string) => void;
  onCommit: (value: string) => void;
  onBlur: (value: string) => void;
};

type TimeSelectorProps = {
  value: TimeValue;
  onHourChange: (value: number | null) => void;
  onMinuteChange: (value: number | null) => void;
};

type IntervalSelectorProps = {
  value: string;
  onCommit: (value: string) => void;
};

type ArrivalSelectorProps = {
  value: string;
  onCommit: (value: string) => void;
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

  const commitValue = React.useCallback(
    (key: ScheduleCellKey, value: string) => {
      if (readOnly) return;
      const normalized = normalizeCellValue(value, config.shiftMode);
      onChange(key, normalized, { commit: true });
    },
    [config.shiftMode, onChange, readOnly]
  );

  const gridTemplateColumns = React.useMemo(() => {
    const dayColumns = days.map(() => "minmax(3.5rem, 1fr)").join(" ");
    return `max-content ${dayColumns}`;
  }, [days]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border border-zinc-300 bg-white"
        style={{ gridTemplateColumns, minWidth: "100%" }}
      >
        <div
          className="flex items-center justify-center border-b border-zinc-300 px-3 py-3 text-center font-semibold"
          style={{ gridColumn: `1 / span ${days.length + 1}` }}
        >
          {title}
        </div>

        <div className="border-b border-zinc-200" />
        {days.map((day) => (
          <div
            key={`weekday-${day.date}`}
            className="flex items-center justify-center border-b border-l border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600"
          >
            {day.weekdayLabel}
          </div>
        ))}

        <div className="border-b border-zinc-200" />
        {days.map((day) => (
          <div
            key={`day-${day.date}`}
            className="flex items-center justify-center border-b border-l border-zinc-200 px-2 py-1.5 text-xs text-zinc-700"
          >
            {day.dayNumber}
          </div>
        ))}

        {rows.map((row, rowIndex) => {
          const rowKey = row.id ?? row.memberId ?? rowIndex;
          return (
            <React.Fragment key={rowKey}>
              <div className="flex flex-col justify-center border-b border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-800">
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
                    className="border-b border-l border-zinc-200 px-1.5 py-1.5 text-sm"
                  >
                    {readOnly ? (
                      <ReadonlyCell value={value} shiftMode={config.shiftMode} />
                    ) : (
                      <EditableCell
                        value={value}
                        shiftMode={config.shiftMode}
                        placeholder={PLACEHOLDERS[config.shiftMode]}
                        onInputChange={(newValue) => onChange(key, newValue)}
                        onCommit={(newValue) => commitValue(key, newValue)}
                        onBlur={(rawValue) => handleBlur(key, rawValue)}
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

function EditableCell({ value, shiftMode, placeholder, onInputChange, onCommit, onBlur }: EditableCellProps) {
  switch (shiftMode) {
    case "ARRIVAL_ONLY":
      return <ArrivalSelector value={value} onCommit={onCommit} />;
    case "FULL":
      return <IntervalSelector value={value} onCommit={onCommit} />;
    case "NONE":
    default:
      return (
        <input
          value={value}
          onChange={(event) => onInputChange(event.target.value)}
          onBlur={(event) => onBlur(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-transparent bg-zinc-50 px-2 text-center text-xs text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
      );
  }
}

function ReadonlyCell({ value, shiftMode }: { value: string; shiftMode: ShiftMode }) {
  if (!value) {
    return (
      <div className="flex min-h-[2.5rem] items-center justify-center rounded-xl bg-white px-1.5 text-center text-xs leading-tight text-zinc-800">
        &nbsp;
      </div>
    );
  }

  if (shiftMode === "FULL" && value.includes("-")) {
    const [from, to] = value
      .split(/[-–—]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <div className="flex min-h-[2.5rem] flex-col items-center justify-center rounded-xl bg-white px-1.5 text-center text-xs leading-tight text-zinc-800">
        <span>{from}</span>
        {to && <span>{to}</span>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[2.5rem] items-center justify-center rounded-xl bg-white px-1.5 text-center text-xs leading-tight text-zinc-800">
      {value}
    </div>
  );
}

function ArrivalSelector({ value, onCommit }: ArrivalSelectorProps) {
  const time = React.useMemo(() => parseTime(value), [value]);

  const handleHourChange = (hour: number | null) => {
    if (hour === null) {
      onCommit("");
      return;
    }

    const minute = normalizeMinute(hour, time.minute ?? 0);
    onCommit(formatTime(hour, minute));
  };

  const handleMinuteChange = (minute: number | null) => {
    if (time.hour === null || minute === null) return;
    onCommit(formatTime(time.hour, normalizeMinute(time.hour, minute)));
  };

  return (
    <div className="flex min-h-[2.5rem] flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 text-xs text-zinc-800">
      <TimeSelector value={time} onHourChange={handleHourChange} onMinuteChange={handleMinuteChange} />
    </div>
  );
}

function IntervalSelector({ value, onCommit }: IntervalSelectorProps) {
  const { from, to } = React.useMemo(() => parseTimeRange(value), [value]);

  const updateRange = (part: "from" | "to", hour: number | null, minute: number | null) => {
    const nextFrom = part === "from" ? { hour, minute } : from;
    const nextTo = part === "to" ? { hour, minute } : to;
    onCommit(formatRange(nextFrom, nextTo));
  };

  return (
    <div className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 text-[11px] text-zinc-800">
      <TimeSelector
        value={from}
        onHourChange={(hour) => updateRange("from", hour, hour === null ? null : from.minute ?? 0)}
        onMinuteChange={(minute) => updateRange("from", from.hour, minute)}
      />
      <TimeSelector
        value={to}
        onHourChange={(hour) => updateRange("to", hour, hour === null ? null : to.minute ?? 0)}
        onMinuteChange={(minute) => updateRange("to", to.hour, minute)}
      />
    </div>
  );
}

function TimeSelector({ value, onHourChange, onMinuteChange }: TimeSelectorProps) {
  const selectedHour = value.hour ?? "";
  const selectedMinute = value.hour === null ? "" : normalizeMinute(value.hour, value.minute ?? 0);

  return (
    <div className="flex w-full items-center justify-center gap-1">
      <select
        value={selectedHour}
        onChange={(event) => {
          const rawValue = event.target.value;
          onHourChange(rawValue === "" ? null : Number(rawValue));
        }}
        className="h-8 w-full min-w-[3.25rem] rounded-lg border border-zinc-200 bg-white px-1 text-center text-xs focus:border-zinc-400 focus:outline-none"
      >
        <option value="">--</option>
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        value={selectedMinute}
        onChange={(event) => {
          const rawValue = event.target.value;
          if (rawValue === "") {
            onMinuteChange(null);
          } else {
            onMinuteChange(Number(rawValue));
          }
        }}
        disabled={value.hour === null}
        className="h-8 w-full min-w-[3.25rem] rounded-lg border border-zinc-200 bg-white px-1 text-center text-xs focus:border-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100"
      >
        <option value="">--</option>
        {MINUTES.map((minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

function parseTime(value: string): TimeValue {
  const trimmed = value.trim();
  if (!trimmed) return { hour: null, minute: null };

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return { hour: null, minute: null };

  const hour = Number(match[1]);
  const minute = typeof match[2] === "string" ? Number(match[2]) : 0;

  if (Number.isNaN(hour) || hour < 0 || hour > 24) return { hour: null, minute: null };
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return { hour: null, minute: null };

  return { hour, minute };
}

function parseTimeRange(value: string): { from: TimeValue; to: TimeValue } {
  const [from, to] = value
    .split(/[-–—]/)
    .map((part) => part.trim())
    .slice(0, 2);

  return {
    from: parseTime(from ?? ""),
    to: parseTime(to ?? ""),
  };
}

function formatRange(from: TimeValue, to: TimeValue): string {
  const fromString = formatTimeValue(from);
  const toString = formatTimeValue(to);

  if (fromString && toString) return `${fromString}-${toString}`;
  if (fromString) return fromString;
  if (toString) return toString;
  return "";
}

function formatTimeValue(time: TimeValue): string {
  if (time.hour === null) return "";
  const safeMinute = normalizeMinute(time.hour, time.minute ?? 0);
  return formatTime(time.hour, safeMinute);
}

function formatTime(hour: number | null, minute: number | null): string {
  if (hour === null) return "";
  const safeMinute = normalizeMinute(hour, minute ?? 0);
  return `${String(hour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
}

function normalizeMinute(hour: number, minute: number): number {
  if (hour === 24) return 0;
  if (MINUTES.includes(minute)) return minute;

  return MINUTES.reduce((closest, current) => {
    const currentDiff = Math.abs(current - minute);
    const closestDiff = Math.abs(closest - minute);
    return currentDiff < closestDiff ? current : closest;
  }, MINUTES[0]);
}

export default ScheduleTable;
