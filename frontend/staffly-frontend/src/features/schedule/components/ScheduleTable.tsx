import React from "react";

import type { ScheduleData, ScheduleCellKey, ShiftMode } from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";
import {
  MINUTE_STEPS,
  formatRangeValue,
  formatTimeWithNormalization,
  hasCompleteRangeValue,
  hasStartWithoutEndValue,
  normalizeMinuteValue,
  parseTimeRangeValue,
  parseTimeValue,
  type TimeValue,
} from "../utils/timeValues";

const HOURS = Array.from({ length: 25 }, (_, index) => index);

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
  highlightEnd?: boolean;
};

type TimeSelectorProps = {
  value: TimeValue;
  onHourChange: (value: number | null) => void;
  onMinuteChange: (value: number | null) => void;
  highlight?: boolean;
};

type IntervalSelectorProps = {
  value: string;
  onCommit: (value: string) => void;
  highlightEnd?: boolean;
};

type ArrivalSelectorProps = {
  value: string;
  onCommit: (value: string) => void;
};

const STICKY_COL_SHADOW = "shadow-[8px_0_10px_-10px_rgba(0,0,0,0.45)]"; // справа тень у липкого столбца
const STICKY_ROW_SHADOW = "shadow-[0_8px_10px_-10px_rgba(0,0,0,0.35)]"; // снизу тень у липких строк

const ScheduleTable: React.FC<Props> = ({ data, onChange, readOnly = false }) => {
  const safeData: ScheduleData = data ?? {
    title: "",
    config: {
      startDate: "",
      endDate: "",
      positionIds: [],
      showFullName: false,
      shiftMode: "FULL",
    },
    days: [],
    rows: [],
    cellValues: {},
  };

  const { days, rows, title, config } = safeData;

  const memberShiftCounts = React.useMemo(() => {
    return rows.map((row) =>
      days.reduce((acc, day) => {
        const value = safeData.cellValues[`${row.memberId}:${day.date}`] ?? "";
        return acc + (hasCompleteRangeValue(value) ? 1 : 0);
      }, 0)
    );
  }, [days, rows, safeData.cellValues]);

  const dayShiftCounts = React.useMemo(() => {
    return days.map((day) =>
      rows.reduce((acc, row) => {
        const value = safeData.cellValues[`${row.memberId}:${day.date}`] ?? "";
        return acc + (hasCompleteRangeValue(value) ? 1 : 0);
      }, 0)
    );
  }, [days, rows, safeData.cellValues]);

  const totalShifts = React.useMemo(
    () => dayShiftCounts.reduce((acc, value) => acc + value, 0),
    [dayShiftCounts]
  );

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
    // первый столбец фиксируем в адекватных рамках (чтобы телефон не умирал)
    const firstCol = "minmax(8.5rem, 9rem)";
    const shouldCompact = readOnly && days.length >= 20;
    const dayCols = days
      .map(() => {
        if (readOnly) {
          return shouldCompact ? "minmax(3.25rem, 3.75rem)" : "minmax(4rem, 1fr)";
        }

        return "minmax(3.5rem, 1fr)";
      })
      .join(" ");
    const shiftsCol = readOnly
      ? shouldCompact
        ? "minmax(3.25rem, 3.75rem)"
        : "minmax(4rem, 4.75rem)"
      : "minmax(4.5rem, 5.5rem)";
    return `${firstCol} ${dayCols} ${shiftsCol}`;
  }, [days, readOnly]);

  if (!data) return null;

  return (
    // ❗️скролл только в ScheduleTableSection (overflow-auto)
    <div className="inline-block min-w-full align-top">
      <div
        className="grid border border-zinc-300 bg-white"
        style={{ gridTemplateColumns, width: "max-content", minWidth: "100%" }}
      >
        {/* Заголовок таблицы (НЕ sticky) */}
        <div
          className="flex items-center justify-center border-b border-zinc-300 px-3 py-3 text-center font-semibold"
          style={{ gridColumn: `1 / span ${days.length + 2}` }}
        >
          {title}
        </div>

        {/* ====== Линия 1: День недели (sticky top-0) ====== */}
        <div
          className={[
            "sticky left-0 top-0 z-50 flex h-10 items-center justify-start",
            "border-b border-r border-zinc-200 bg-white px-3",
            "text-xs font-semibold text-zinc-700",
            STICKY_COL_SHADOW,
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          День недели
        </div>

        {days.map((day) => (
          <div
            key={`weekday-${day.date}`}
            className={[
              "sticky top-0 z-40 flex h-10 items-center justify-center",
              "border-b border-l border-zinc-200 bg-white px-2",
              "text-xs font-medium text-zinc-600",
              STICKY_ROW_SHADOW,
            ].join(" ")}
          >
            {day.weekdayLabel}
          </div>
        ))}

        <div
          className={[
            "sticky top-0 z-40 flex h-10 items-center justify-center",
            "border-b border-l border-zinc-200 bg-white px-2 text-center",
            "text-xs font-semibold text-zinc-700",
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          Кол-во смен
        </div>

        {/* ====== Линия 2: День месяца (sticky top-10) ====== */}
        <div
          className={[
            "sticky left-0 top-10 z-50 flex h-10 items-center justify-start",
            "border-b border-r border-zinc-200 bg-white px-3",
            "text-xs font-semibold text-zinc-700",
            STICKY_COL_SHADOW,
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          День месяца
        </div>

        {days.map((day) => (
          <div
            key={`day-${day.date}`}
            className={[
              "sticky top-10 z-40 flex h-10 items-center justify-center",
              "border-b border-l border-zinc-200 bg-white px-2",
              "text-xs text-zinc-700",
              STICKY_ROW_SHADOW,
            ].join(" ")}
          >
            {day.dayNumber}
          </div>
        ))}

        <div
          className={[
            "sticky top-10 z-40 flex h-10 items-center justify-center",
            "border-b border-l border-zinc-200 bg-white px-2 text-center",
            "text-xs font-medium text-zinc-700",
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          Итого
        </div>

        {/* ====== Данные ====== */}
        {rows.map((row, rowIndex) => {
          const rowKey = row.id ?? row.memberId ?? rowIndex;

          return (
            <React.Fragment key={rowKey}>
              {/* Липкий столбец с именем */}
              <div
                className={[
                  "sticky left-0 z-30 flex flex-col justify-center",
                  "border-b border-r border-zinc-200 bg-white px-3 py-3",
                  "text-sm font-medium text-zinc-800",
                  STICKY_COL_SHADOW,
                ].join(" ")}
              >
                <span className="truncate">{row.displayName}</span>
                {row.positionName && (
                  <span className="truncate text-xs font-normal text-zinc-500">
                    {row.positionName}
                  </span>
                )}
              </div>

              {days.map((day) => {
                const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
                const value = data.cellValues[key] ?? "";
                const missingEnd = hasStartWithoutEndValue(value);

                return (
                    <div
                      key={key}
                      className="border-b border-l border-zinc-200 px-1.5 py-1 text-sm"
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
                        highlightEnd={!readOnly && missingEnd}
                      />
                    )}
                  </div>
                );
              })}

              <div className="border-b border-l border-zinc-200 px-1.5 py-1 text-sm">
                <div className="flex min-h-[2.25rem] items-center justify-center rounded-xl bg-white px-1 text-center text-xs font-semibold leading-tight text-zinc-800">
                  {memberShiftCounts[rowIndex] ?? 0}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Строка с количеством сотрудников в смене */}
        <div
          className={[
            "sticky left-0 z-20 flex flex-col justify-center",
            "border-b border-r border-zinc-200 bg-white px-3 py-3",
            "text-sm font-semibold text-zinc-800",
            STICKY_COL_SHADOW,
          ].join(" ")}
        >
          Кол-во сотрудников
        </div>

        {days.map((day, index) => (
          <div
            key={`day-count-${day.date}`}
            className="border-b border-l border-zinc-200 px-1.5 py-1 text-sm"
          >
            <div className="flex min-h-[2.25rem] items-center justify-center rounded-xl bg-white px-1 text-center text-xs font-semibold leading-tight text-zinc-800">
              {dayShiftCounts[index] ?? 0}
            </div>
          </div>
        ))}

        <div className="border-b border-l border-zinc-200 px-1.5 py-1 text-sm">
          <div className="flex min-h-[2.25rem] items-center justify-center rounded-xl bg-white px-1 text-center text-xs font-semibold leading-tight text-zinc-800">
            {totalShifts}
          </div>
        </div>
      </div>
    </div>
  );
};

function EditableCell({
  value,
  shiftMode,
  placeholder,
  onInputChange,
  onCommit,
  onBlur,
  highlightEnd,
}: EditableCellProps) {
  switch (shiftMode) {
    case "ARRIVAL_ONLY":
      return <ArrivalSelector value={value} onCommit={onCommit} />;
    case "FULL":
      return <IntervalSelector value={value} onCommit={onCommit} highlightEnd={highlightEnd} />;
    case "NONE":
    default:
      return (
        <input
          value={value}
          onChange={(event) => onInputChange(event.target.value)}
          onBlur={(event) => onBlur(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-transparent bg-zinc-50 px-2 text-center text-base text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
      );
  }
}

function ReadonlyCell({ value, shiftMode }: { value: string; shiftMode: ShiftMode }) {
  if (!value) {
    return (
      <div className="flex min-h-[2.25rem] items-center justify-center rounded-xl bg-white px-1 text-center text-xs leading-tight text-zinc-400">
        —
      </div>
    );
  }

  if (shiftMode === "FULL" && value.includes("-")) {
    const [from, to] = value
      .split(/[-–—]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <div className="flex min-h-[2.25rem] flex-col items-center justify-center rounded-xl bg-white px-1 text-center text-xs leading-tight text-zinc-800">
        <span>{from}</span>
        {to && <span>{to}</span>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[2.25rem] items-center justify-center rounded-xl bg-white px-1 text-center text-xs leading-tight text-zinc-800">
      {value}
    </div>
  );
}

function ArrivalSelector({ value, onCommit }: ArrivalSelectorProps) {
  const time = React.useMemo(() => parseTimeValue(value), [value]);

  const handleHourChange = (hour: number | null) => {
    if (hour === null) {
      onCommit("");
      return;
    }
    const minute = normalizeMinuteValue(hour, time.minute ?? 0);
    onCommit(formatTimeWithNormalization(hour, minute));
  };

  const handleMinuteChange = (minute: number | null) => {
    if (time.hour === null || minute === null) return;
    onCommit(formatTimeWithNormalization(time.hour, minute));
  };

  return (
    <div className="flex min-h-[2.25rem] flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 text-xs text-zinc-800">
      <TimeSelector value={time} onHourChange={handleHourChange} onMinuteChange={handleMinuteChange} />
    </div>
  );
}

function IntervalSelector({ value, onCommit, highlightEnd }: IntervalSelectorProps) {
  const { from, to } = React.useMemo(() => parseTimeRangeValue(value), [value]);

  const updateRange = (part: "from" | "to", hour: number | null, minute: number | null) => {
    const nextFrom = part === "from" ? { hour, minute } : from;
    const nextTo = part === "to" ? { hour, minute } : to;
    onCommit(formatRangeValue(nextFrom, nextTo));
  };

  const showHighlight = Boolean(highlightEnd && from.hour !== null && to.hour === null);

  return (
    <div className="flex min-h-[2.75rem] flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 text-[11px] text-zinc-800">
      <TimeSelector
        value={from}
        onHourChange={(hour) => updateRange("from", hour, hour === null ? null : from.minute ?? 0)}
        onMinuteChange={(minute) => updateRange("from", from.hour, minute)}
      />
      <TimeSelector
        highlight={showHighlight}
        value={to}
        onHourChange={(hour) => updateRange("to", hour, hour === null ? null : to.minute ?? 0)}
        onMinuteChange={(minute) => updateRange("to", to.hour, minute)}
      />
      {showHighlight && (
        <span className="text-[10px] font-medium text-amber-600">Укажите время ухода</span>
      )}
    </div>
  );
}

function TimeSelector({ value, onHourChange, onMinuteChange, highlight }: TimeSelectorProps) {
  const selectedHour = value.hour ?? "";
  const selectedMinute =
    value.hour === null ? "" : normalizeMinuteValue(value.hour, value.minute ?? 0);

  const baseClasses =
    "h-8 w-full min-w-[3.25rem] rounded-lg border border-zinc-200 bg-white px-1 text-center text-base focus:border-zinc-400 focus:outline-none";
  const highlightClasses = highlight
    ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
    : "";

  return (
    <div className="flex w-full items-center justify-center gap-1">
      <select
        value={selectedHour}
        onChange={(event) => {
          const rawValue = event.target.value;
          onHourChange(rawValue === "" ? null : Number(rawValue));
        }}
        className={`${baseClasses} ${highlightClasses}`.trim()}
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
          if (rawValue === "") onMinuteChange(null);
          else onMinuteChange(Number(rawValue));
        }}
        disabled={value.hour === null}
        className={`${baseClasses} ${highlightClasses} disabled:cursor-not-allowed disabled:bg-zinc-100`.trim()}
      >
        <option value="">--</option>
        {MINUTE_STEPS.map((minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ScheduleTable;
