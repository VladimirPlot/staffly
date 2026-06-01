import React from "react";

import DropdownSelect from "../../../shared/ui/DropdownSelect";
import type {
  ScheduleCellKey,
  ScheduleCellSource,
  ScheduleData,
  ScheduleDay,
  SchedulePreferenceHintsByCellKey,
  ScheduleRow,
  ShiftMode,
} from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";
import {
  canApplyPreferenceHint,
  formatPreferenceHintTime,
  getPreferenceHintLabel,
  getPreferenceHintTone,
  hasNegativePreferenceConflict,
} from "../utils/preferenceHints";
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

const STICKY_COL_SHADOW = "shadow-[8px_0_10px_-10px_rgba(0,0,0,0.45)]"; // справа тень у липкого столбца
const STICKY_ROW_SHADOW = "shadow-[0_8px_10px_-10px_rgba(0,0,0,0.35)]"; // снизу тень у липких строк

type Props = {
  data: ScheduleData | null | undefined;
  onChange: (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => void;
  readOnly?: boolean;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
};

type CellValues = ScheduleData["cellValues"];
type CellSources = NonNullable<ScheduleData["cellSources"]>;

const EMPTY_DAYS: ScheduleDay[] = [];
const EMPTY_ROWS: ScheduleRow[] = [];
const EMPTY_CELL_VALUES: CellValues = {};
const EMPTY_CELL_SOURCES: CellSources = {};

type ScheduleTableHeaderProps = {
  title: string;
  days: ScheduleDay[];
};

type ScheduleTableRowProps = {
  row: ScheduleRow;
  days: ScheduleDay[];
  cellValues: CellValues;
  cellSources: CellSources;
  memberShiftCount: number;
  readOnly: boolean;
  shiftMode: ShiftMode;
  placeholder: string;
  onCellValueChange: (memberId: number, day: string, value: string, options?: { commit?: boolean }) => void;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
};

type ScheduleCellEditorProps = {
  memberId: number;
  day: string;
  value: string;
  source?: ScheduleCellSource;
  shiftMode: ShiftMode;
  placeholder: string;
  readOnly: boolean;
  onCellValueChange: (memberId: number, day: string, value: string, options?: { commit?: boolean }) => void;
  hints?: import("../api").SchedulePreferenceCellDto[];
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

const ScheduleTable: React.FC<Props> = ({ data, onChange, readOnly = false, preferenceHintsByCellKey }) => {
  const shiftMode = data?.config.shiftMode ?? "FULL";
  const days = data?.days ?? EMPTY_DAYS;
  const rows = data?.rows ?? EMPTY_ROWS;
  const cellValues = data?.cellValues ?? EMPTY_CELL_VALUES;
  const cellSources = data?.cellSources ?? EMPTY_CELL_SOURCES;

  const { memberShiftCounts, dayShiftCounts, totalShifts } = React.useMemo(() => {
    const nextMemberShiftCounts = rows.map(() => 0);
    const nextDayShiftCounts = days.map(() => 0);
    let nextTotalShifts = 0;

    rows.forEach((row, rowIndex) => {
      days.forEach((day, dayIndex) => {
        const value = cellValues[`${row.memberId}:${day.date}`] ?? "";
        if (!hasCompleteRangeValue(value)) return;
        nextMemberShiftCounts[rowIndex] += 1;
        nextDayShiftCounts[dayIndex] += 1;
        nextTotalShifts += 1;
      });
    });

    return {
      memberShiftCounts: nextMemberShiftCounts,
      dayShiftCounts: nextDayShiftCounts,
      totalShifts: nextTotalShifts,
    };
  }, [cellValues, days, rows]);

  const handleCellValueChange = React.useCallback(
    (memberId: number, day: string, value: string, options?: { commit?: boolean }) => {
      if (readOnly) return;
      onChange(`${memberId}:${day}`, value, options);
    },
    [onChange, readOnly],
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
        className="border-subtle bg-surface grid border"
        style={{ gridTemplateColumns, width: "max-content", minWidth: "100%" }}
      >
        <ScheduleTableHeader title={data.title} days={days} />

        {rows.map((row, rowIndex) => (
          <ScheduleTableRow
            key={row.id ?? row.memberId ?? rowIndex}
            row={row}
            days={days}
            cellValues={cellValues}
            cellSources={cellSources}
            memberShiftCount={memberShiftCounts[rowIndex] ?? 0}
            readOnly={readOnly}
            shiftMode={shiftMode}
            placeholder={PLACEHOLDERS[shiftMode]}
            onCellValueChange={handleCellValueChange}
            preferenceHintsByCellKey={preferenceHintsByCellKey}
          />
        ))}

        <ScheduleTableFooter days={days} dayShiftCounts={dayShiftCounts} totalShifts={totalShifts} />
      </div>
    </div>
  );
};

const ScheduleTableHeader = React.memo(function ScheduleTableHeader({ title, days }: ScheduleTableHeaderProps) {
  return (
    <>
      {/* Заголовок таблицы (НЕ sticky) */}
      <div
        className="border-subtle flex items-center justify-center border-b px-3 py-3 text-center font-semibold"
        style={{ gridColumn: `1 / span ${days.length + 2}` }}
      >
        {title}
      </div>

      {/* ====== Линия 1: День недели (sticky top-0) ====== */}
      <div
        className={[
          "sticky top-0 left-0 z-50 flex h-10 items-center justify-start",
          "border-subtle bg-surface border-r border-b px-3",
          "text-default text-xs font-semibold",
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
            "border-subtle bg-surface border-b border-l px-2",
            "text-muted text-xs font-medium",
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          {day.weekdayLabel}
        </div>
      ))}

      <div
        className={[
          "sticky top-0 z-40 flex h-10 items-center justify-center",
          "border-subtle bg-surface border-b border-l px-2 text-center",
          "text-default text-xs font-semibold",
          STICKY_ROW_SHADOW,
        ].join(" ")}
      >
        Кол-во смен
      </div>

      {/* ====== Линия 2: День месяца (sticky top-10) ====== */}
      <div
        className={[
          "sticky top-10 left-0 z-50 flex h-10 items-center justify-start",
          "border-subtle bg-surface border-r border-b px-3",
          "text-default text-xs font-semibold",
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
            "border-subtle bg-surface border-b border-l px-2",
            "text-default text-xs",
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          {day.dayNumber}
        </div>
      ))}

      <div
        className={[
          "sticky top-10 z-40 flex h-10 items-center justify-center",
          "border-subtle bg-surface border-b border-l px-2 text-center",
          "text-default text-xs font-medium",
          STICKY_ROW_SHADOW,
        ].join(" ")}
      >
        Итого
      </div>
    </>
  );
});

const ScheduleTableRow = React.memo(
  function ScheduleTableRow({
    row,
    days,
    cellValues,
    cellSources,
    memberShiftCount,
    readOnly,
    shiftMode,
    placeholder,
    onCellValueChange,
    preferenceHintsByCellKey,
  }: ScheduleTableRowProps) {
    return (
      <>
        {/* Липкий столбец с именем */}
        <div
          className={[
            "sticky left-0 z-30 flex flex-col justify-center",
            "border-subtle bg-surface border-r border-b px-3 py-3",
            "text-strong text-sm font-medium",
            STICKY_COL_SHADOW,
          ].join(" ")}
        >
          <span className="truncate">{row.displayName}</span>
          {row.positionName && <span className="text-muted truncate text-xs font-normal">{row.positionName}</span>}
        </div>

        {days.map((day) => {
          const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
          return (
            <ScheduleCellEditor
              key={key}
              memberId={row.memberId}
              day={day.date}
              value={cellValues[key] ?? ""}
              source={cellSources[key] ?? "MANUAL"}
              shiftMode={shiftMode}
              placeholder={placeholder}
              readOnly={readOnly}
              onCellValueChange={onCellValueChange}
              hints={preferenceHintsByCellKey?.[key]}
            />
          );
        })}

        <ShiftCountCell value={memberShiftCount} />
      </>
    );
  },
  (prev, next) => {
    if (
      prev.row !== next.row ||
      prev.days !== next.days ||
      prev.memberShiftCount !== next.memberShiftCount ||
      prev.readOnly !== next.readOnly ||
      prev.shiftMode !== next.shiftMode ||
      prev.placeholder !== next.placeholder ||
      prev.onCellValueChange !== next.onCellValueChange ||
      prev.cellSources !== next.cellSources ||
      prev.preferenceHintsByCellKey !== next.preferenceHintsByCellKey
    ) {
      return false;
    }

    return prev.days.every((day) => {
      const key: ScheduleCellKey = `${prev.row.memberId}:${day.date}`;
      return (
        (prev.cellValues[key] ?? "") === (next.cellValues[key] ?? "") &&
        (prev.cellSources[key] ?? "MANUAL") === (next.cellSources[key] ?? "MANUAL")
      );
    });
  },
);

const ScheduleCellEditor = React.memo(function ScheduleCellEditor({
  memberId,
  day,
  value,
  source,
  shiftMode,
  placeholder,
  readOnly,
  onCellValueChange,
  hints,
}: ScheduleCellEditorProps) {
  const handleInputChange = React.useCallback(
    (newValue: string) => onCellValueChange(memberId, day, newValue),
    [day, memberId, onCellValueChange],
  );

  const handleCommit = React.useCallback(
    (newValue: string) => {
      const normalized = normalizeCellValue(newValue, shiftMode);
      onCellValueChange(memberId, day, normalized, { commit: true });
    },
    [day, memberId, onCellValueChange, shiftMode],
  );

  const handleBlur = React.useCallback(
    (rawValue: string) => {
      const normalized = normalizeCellValue(rawValue, shiftMode);
      onCellValueChange(memberId, day, normalized, { commit: true });
    },
    [day, memberId, onCellValueChange, shiftMode],
  );

  const missingEnd = shiftMode === "FULL" && hasStartWithoutEndValue(value);
  const hasConflict = hints
    ? hasNegativePreferenceConflict({
        value,
        hints,
        shiftMode,
      })
    : false;
  const conflictLabel = "Заполненная смена конфликтует с отрицательным пожеланием сотрудника";

  const sourceLabel = getScheduleCellSourceLabel(source);

  return (
    <div
      className={[
        "border-subtle border-b border-l px-1.5 py-1 text-sm",
        hasConflict ? "bg-amber-50/80 ring-1 ring-amber-200 ring-inset" : "",
      ].join(" ")}
      title={hasConflict ? conflictLabel : undefined}
      aria-label={hasConflict ? conflictLabel : undefined}
    >
      {readOnly ? (
        <ReadonlyCell value={value} shiftMode={shiftMode} />
      ) : (
        <EditableCell
          value={value}
          shiftMode={shiftMode}
          placeholder={placeholder}
          onInputChange={handleInputChange}
          onCommit={handleCommit}
          onBlur={handleBlur}
          highlightEnd={missingEnd}
        />
      )}

      {value.trim() && sourceLabel && (
        <div className="mt-1 flex justify-center">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
            {sourceLabel}
          </span>
        </div>
      )}
      {hasConflict && (
        <div className="mt-1 flex justify-center">
          <span
            className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
            aria-label={conflictLabel}
            title={conflictLabel}
          >
            Конфликт
          </span>
        </div>
      )}
      {hints && hints.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {hints.map((cell) => {
            const label = getPreferenceHintLabel(cell.type);
            const timeLabel = formatPreferenceHintTime(cell);
            const canApply = canApplyPreferenceHint({ readOnly, shiftMode, cell });
            return (
              <div
                key={`${cell.id ?? `${cell.day}:${cell.sortOrder}`}:${cell.type}`}
                className="flex items-center gap-1"
              >
                <span
                  className={[
                    "rounded border px-1.5 py-0.5 text-[10px]",
                    getPreferenceHintTone(cell.type) === "positive"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  ].join(" ")}
                >
                  {`${label} ${timeLabel}`.trim()}
                </span>
                {canApply && (
                  <button
                    type="button"
                    className="border-subtle bg-surface text-muted hover:bg-app rounded border px-1 py-0.5 text-[10px]"
                    aria-label={`${value.trim() ? "Заменить смену на пожелание" : "Применить пожелание"} ${timeLabel}`}
                    title={`${value.trim() ? "Заменить смену на пожелание" : "Применить пожелание"} ${timeLabel}`}
                    onClick={() =>
                      onCellValueChange(memberId, day, `${cell.startTime}-${cell.endTime}`, { commit: true })
                    }
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

function getScheduleCellSourceLabel(source?: ScheduleCellSource): string | null {
  switch (source) {
    case "AUTO_BUILD":
      return "Авто";
    case "PREFERENCE_HINT":
      return "Пожелание";
    case "MANUAL":
    default:
      return null;
  }
}

const ScheduleTableFooter = React.memo(function ScheduleTableFooter({
  days,
  dayShiftCounts,
  totalShifts,
}: {
  days: ScheduleDay[];
  dayShiftCounts: number[];
  totalShifts: number;
}) {
  return (
    <>
      {/* Строка с количеством сотрудников в смене */}
      <div
        className={[
          "sticky left-0 z-20 flex flex-col justify-center",
          "border-subtle bg-surface border-r border-b px-3 py-3",
          "text-strong text-sm font-semibold",
          STICKY_COL_SHADOW,
        ].join(" ")}
      >
        Кол-во сотрудников
      </div>

      {days.map((day, index) => (
        <ShiftCountCell key={`day-count-${day.date}`} value={dayShiftCounts[index] ?? 0} />
      ))}

      <ShiftCountCell value={totalShifts} />
    </>
  );
});

const ShiftCountCell = React.memo(function ShiftCountCell({ value }: { value: number }) {
  return (
    <div className="border-subtle border-b border-l px-1.5 py-1 text-sm">
      <div className="bg-surface text-strong flex min-h-[2.25rem] items-center justify-center rounded-xl px-1 text-center text-xs leading-tight font-semibold">
        {value}
      </div>
    </div>
  );
});

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
          className="bg-app text-strong focus:bg-surface ring-default h-10 w-full rounded-lg border border-transparent px-2 text-center text-base focus:ring-2 focus:outline-none"
        />
      );
  }
}

function ReadonlyCell({ value, shiftMode }: { value: string; shiftMode: ShiftMode }) {
  if (!value) {
    return (
      <div className="bg-surface text-muted flex min-h-[2.25rem] items-center justify-center rounded-xl px-1 text-center text-xs leading-tight">
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
      <div className="bg-surface text-strong flex min-h-[2.25rem] flex-col items-center justify-center rounded-xl px-1 text-center text-xs leading-tight">
        <span>{from}</span>
        {to && <span>{to}</span>}
      </div>
    );
  }

  return (
    <div className="bg-surface text-strong flex min-h-[2.25rem] items-center justify-center rounded-xl px-1 text-center text-xs leading-tight">
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
    <div className="bg-surface text-strong flex min-h-[2.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs">
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
    <div className="bg-surface text-strong flex min-h-[2.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px]">
      <TimeSelector
        value={from}
        onHourChange={(hour) => updateRange("from", hour, hour === null ? null : (from.minute ?? 0))}
        onMinuteChange={(minute) => updateRange("from", from.hour, minute)}
      />
      <TimeSelector
        highlight={showHighlight}
        value={to}
        onHourChange={(hour) => updateRange("to", hour, hour === null ? null : (to.minute ?? 0))}
        onMinuteChange={(minute) => updateRange("to", to.hour, minute)}
      />
      {showHighlight && <span className="text-[10px] font-medium text-amber-600">Укажите время ухода</span>}
    </div>
  );
}

function TimeSelector({ value, onHourChange, onMinuteChange, highlight }: TimeSelectorProps) {
  const selectedHour = value.hour ?? "";
  const selectedMinute = value.hour === null ? "" : normalizeMinuteValue(value.hour, value.minute ?? 0);

  const baseClasses =
    "h-8 w-full min-w-[3.25rem] rounded-lg border border-subtle bg-surface px-1 text-center text-base focus:outline-none focus:ring-2 ring-default";
  const highlightClasses = highlight ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200" : "";

  return (
    <div className="flex w-full items-center justify-center gap-1">
      <DropdownSelect
        aria-label="Часы"
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
      </DropdownSelect>

      <DropdownSelect
        aria-label="Минуты"
        value={selectedMinute}
        onChange={(event) => {
          const rawValue = event.target.value;
          if (rawValue === "") onMinuteChange(null);
          else onMinuteChange(Number(rawValue));
        }}
        disabled={value.hour === null}
        className={`${baseClasses} ${highlightClasses} disabled:bg-app disabled:cursor-not-allowed`.trim()}
      >
        <option value="">--</option>
        {MINUTE_STEPS.map((minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, "0")}
          </option>
        ))}
      </DropdownSelect>
    </div>
  );
}

export default ScheduleTable;
