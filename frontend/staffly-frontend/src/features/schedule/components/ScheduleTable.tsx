import React from "react";

import DropdownSelect from "../../../shared/ui/DropdownSelect";
import type { ScheduleAutoBuildRejectionHintDto, SchedulePreferenceCellDto } from "../api";
import type {
  ScheduleCellChangeOptions,
  ScheduleCellKey,
  ScheduleCellSource,
  ScheduleData,
  ScheduleDay,
  SchedulePreferenceHintsByCellKey,
  ScheduleRejectionHintsByCellKey,
  ScheduleRow,
  ShiftMode,
} from "../types";
import { normalizeCellValue } from "../utils/cellFormatting";
import {
  canApplyPreferenceHint,
  formatPreferenceHintTime,
  getAutoBuildPreferenceAssignmentBadge,
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

type ScheduleTableZoomStyle = React.CSSProperties & {
  "--schedule-zoom": number;
};

const scheduleZoomCss = {
  cellPadding:
    "px-[max(0.25rem,calc(0.375rem*var(--schedule-zoom)))] py-[max(0.2rem,calc(0.25rem*var(--schedule-zoom)))]",
  headerHeight: "h-[max(2rem,calc(2.5rem*var(--schedule-zoom)))]",
  headerPaddingX: "px-[max(0.4rem,calc(0.75rem*var(--schedule-zoom)))]",
  dayPaddingX: "px-[max(0.25rem,calc(0.5rem*var(--schedule-zoom)))]",
  headerText: "text-[max(0.65rem,calc(0.75rem*var(--schedule-zoom)))]",
  titleText: "text-[max(0.8rem,calc(1rem*var(--schedule-zoom)))]",
  memberText: "text-[max(0.72rem,calc(0.875rem*var(--schedule-zoom)))]",
  metaText: "text-[max(0.62rem,calc(0.75rem*var(--schedule-zoom)))]",
  badgeText: "text-[max(0.55rem,calc(0.625rem*var(--schedule-zoom)))]",
  badgePadding:
    "px-[max(0.25rem,calc(0.5rem*var(--schedule-zoom)))] py-[max(0.08rem,calc(0.125rem*var(--schedule-zoom)))]",
  editableShell:
    "min-h-[max(1.8rem,calc(2.75rem*var(--schedule-zoom)))] gap-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))] rounded-[max(0.5rem,calc(0.75rem*var(--schedule-zoom)))] px-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))] text-[max(0.62rem,calc(0.6875rem*var(--schedule-zoom)))]",
  readonlyShell:
    "min-h-[max(1.45rem,calc(2.25rem*var(--schedule-zoom)))] rounded-[max(0.5rem,calc(0.75rem*var(--schedule-zoom)))] px-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))] text-[max(0.62rem,calc(0.75rem*var(--schedule-zoom)))]",
  select:
    "h-[max(1.45rem,calc(2rem*var(--schedule-zoom)))] min-w-[max(2.15rem,calc(3.25rem*var(--schedule-zoom)))] rounded-[max(0.35rem,calc(0.5rem*var(--schedule-zoom)))] px-[max(0.1rem,calc(0.25rem*var(--schedule-zoom)))] text-[max(0.65rem,calc(1rem*var(--schedule-zoom)))]",
  timeSelectorGap: "gap-[max(0.12rem,calc(0.25rem*var(--schedule-zoom)))]",
};

type Props = {
  data: ScheduleData | null | undefined;
  onChange: (key: ScheduleCellKey, value: string, options?: ScheduleCellChangeOptions) => void;
  readOnly?: boolean;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
  preferenceCommentsByMemberId?: Record<number, string>;
  rejectionHintsByCellKey?: ScheduleRejectionHintsByCellKey;
  showCellDiagnostics?: boolean;
  zoomScale?: number;
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
  onCellValueChange: (memberId: number, day: string, value: string, options?: ScheduleCellChangeOptions) => void;
  preferenceHintsByCellKey?: SchedulePreferenceHintsByCellKey;
  preferenceCommentsByMemberId?: Record<number, string>;
  rejectionHintsByCellKey?: ScheduleRejectionHintsByCellKey;
  showCellDiagnostics: boolean;
};

type ScheduleCellEditorProps = {
  memberId: number;
  day: string;
  value: string;
  source?: ScheduleCellSource;
  shiftMode: ShiftMode;
  placeholder: string;
  readOnly: boolean;
  onCellValueChange: (memberId: number, day: string, value: string, options?: ScheduleCellChangeOptions) => void;
  hints?: SchedulePreferenceCellDto[];
  rejectionHints?: ScheduleAutoBuildRejectionHintDto[];
  showCellDiagnostics: boolean;
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

const ScheduleTable: React.FC<Props> = ({
  data,
  onChange,
  readOnly = false,
  preferenceHintsByCellKey,
  preferenceCommentsByMemberId,
  rejectionHintsByCellKey,
  showCellDiagnostics = false,
  zoomScale = 1,
}) => {
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
    (memberId: number, day: string, value: string, options?: ScheduleCellChangeOptions) => {
      if (readOnly) return;
      onChange(`${memberId}:${day}`, value, options);
    },
    [onChange, readOnly],
  );

  const gridTemplateColumns = React.useMemo(() => {
    // В editable режиме колонкам нужно место под две пары селектов времени,
    // но внутренние controls теперь тоже пропорционально уменьшаются через --schedule-zoom.
    // В readOnly режиме оставляем таблицу компактнее, особенно для длинных периодов.
    const firstColWidth = Math.max(6.25, 9 * zoomScale);
    const shouldCompact = readOnly && days.length >= 20;
    const dayColWidth = readOnly
      ? shouldCompact
        ? Math.max(2.6, 3.75 * zoomScale)
        : Math.max(3.25, 4.75 * zoomScale)
      : Math.max(5.5, 8.5 * zoomScale);
    const shiftsColWidth = readOnly ? dayColWidth : Math.max(3.75, 5.75 * zoomScale);
    const firstCol = `minmax(${Math.max(6, firstColWidth - 0.5).toFixed(2)}rem, ${firstColWidth.toFixed(2)}rem)`;
    const dayCols = days.map(() => `minmax(${dayColWidth.toFixed(2)}rem, 1fr)`).join(" ");
    const shiftsCol = `minmax(${shiftsColWidth.toFixed(2)}rem, ${readOnly ? "1fr" : `${shiftsColWidth.toFixed(2)}rem`})`;
    return `${firstCol} ${dayCols} ${shiftsCol}`;
  }, [days, readOnly, zoomScale]);

  if (!data) return null;

  return (
    // ❗️скролл только в ScheduleTableSection (overflow-auto)
    <div
      className="inline-block min-w-full align-top"
      data-schedule-table-zoom={Math.round(zoomScale * 100)}
      style={{ "--schedule-zoom": zoomScale } as ScheduleTableZoomStyle}
    >
      <div
        className="border-subtle bg-surface grid border"
        style={{ gridTemplateColumns, width: "100%", minWidth: "max-content" }}
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
            preferenceHintsByCellKey={showCellDiagnostics ? preferenceHintsByCellKey : undefined}
            preferenceCommentsByMemberId={showCellDiagnostics ? preferenceCommentsByMemberId : undefined}
            rejectionHintsByCellKey={showCellDiagnostics ? rejectionHintsByCellKey : undefined}
            showCellDiagnostics={showCellDiagnostics}
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
        className={[
          "border-subtle flex items-center justify-center border-b text-center font-semibold",
          scheduleZoomCss.headerPaddingX,
          "py-[max(0.5rem,calc(0.75rem*var(--schedule-zoom)))]",
          scheduleZoomCss.titleText,
        ].join(" ")}
        style={{ gridColumn: `1 / span ${days.length + 2}` }}
      >
        {title}
      </div>

      {/* ====== Линия 1: День недели (sticky top-0) ====== */}
      <div
        className={[
          "sticky top-0 left-0 z-50 flex items-center justify-start",
          scheduleZoomCss.headerHeight,
          "border-subtle bg-surface border-r border-b",
          scheduleZoomCss.headerPaddingX,
          "text-default font-semibold",
          scheduleZoomCss.headerText,
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
            "sticky top-0 z-40 flex items-center justify-center",
            scheduleZoomCss.headerHeight,
            "border-subtle bg-surface border-b border-l",
            scheduleZoomCss.dayPaddingX,
            "text-muted font-medium",
            scheduleZoomCss.headerText,
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          {day.weekdayLabel}
        </div>
      ))}

      <div
        className={[
          "sticky top-0 z-40 flex items-center justify-center",
          scheduleZoomCss.headerHeight,
          "border-subtle bg-surface border-b border-l text-center",
          scheduleZoomCss.dayPaddingX,
          "text-default font-semibold",
          scheduleZoomCss.headerText,
          STICKY_ROW_SHADOW,
        ].join(" ")}
      >
        Кол-во смен
      </div>

      {/* ====== Линия 2: День месяца (sticky top-10) ====== */}
      <div
        className={[
          "sticky top-[max(2rem,calc(2.5rem*var(--schedule-zoom)))] left-0 z-50 flex items-center justify-start",
          scheduleZoomCss.headerHeight,
          "border-subtle bg-surface border-r border-b",
          scheduleZoomCss.headerPaddingX,
          "text-default font-semibold",
          scheduleZoomCss.headerText,
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
            "sticky top-[max(2rem,calc(2.5rem*var(--schedule-zoom)))] z-40 flex items-center justify-center",
            scheduleZoomCss.headerHeight,
            "border-subtle bg-surface border-b border-l",
            scheduleZoomCss.dayPaddingX,
            "text-default",
            scheduleZoomCss.headerText,
            STICKY_ROW_SHADOW,
          ].join(" ")}
        >
          {day.dayNumber}
        </div>
      ))}

      <div
        className={[
          "sticky top-[max(2rem,calc(2.5rem*var(--schedule-zoom)))] z-40 flex items-center justify-center",
          scheduleZoomCss.headerHeight,
          "border-subtle bg-surface border-b border-l text-center",
          scheduleZoomCss.dayPaddingX,
          "text-default font-medium",
          scheduleZoomCss.headerText,
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
    preferenceCommentsByMemberId,
    rejectionHintsByCellKey,
    showCellDiagnostics,
  }: ScheduleTableRowProps) {
    return (
      <>
        {/* Липкий столбец с именем */}
        <div
          className={[
            "sticky left-0 z-30 flex flex-col justify-center",
            "border-subtle bg-surface border-r border-b",
            scheduleZoomCss.headerPaddingX,
            "py-[max(0.45rem,calc(0.75rem*var(--schedule-zoom)))]",
            "text-strong font-medium",
            scheduleZoomCss.memberText,
            STICKY_COL_SHADOW,
          ].join(" ")}
        >
          <span className="flex min-w-0 items-center gap-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))]">
            <span className="truncate">{row.displayName}</span>
            {showCellDiagnostics && preferenceCommentsByMemberId?.[row.memberId] && (
              <span
                className="border-subtle bg-surface text-muted inline-flex h-[max(0.8rem,calc(1rem*var(--schedule-zoom)))] w-[max(0.8rem,calc(1rem*var(--schedule-zoom)))] shrink-0 items-center justify-center rounded-full border text-[max(0.5rem,calc(0.625rem*var(--schedule-zoom)))] font-semibold"
                title={preferenceCommentsByMemberId[row.memberId]}
                aria-label="Комментарий к периоду"
              >
                i
              </span>
            )}
          </span>
          {row.positionName && (
            <span className={["text-muted truncate font-normal", scheduleZoomCss.metaText].join(" ")}>
              {row.positionName}
            </span>
          )}
        </div>

        {days.map((day) => {
          const key: ScheduleCellKey = `${row.memberId}:${day.date}`;
          return (
            <ScheduleCellEditor
              key={key}
              memberId={row.memberId}
              day={day.date}
              value={cellValues[key] ?? ""}
              source={showCellDiagnostics ? (cellSources[key] ?? "MANUAL") : undefined}
              shiftMode={shiftMode}
              placeholder={placeholder}
              readOnly={readOnly}
              onCellValueChange={onCellValueChange}
              hints={showCellDiagnostics ? preferenceHintsByCellKey?.[key] : undefined}
              rejectionHints={showCellDiagnostics ? rejectionHintsByCellKey?.[key] : undefined}
              showCellDiagnostics={showCellDiagnostics}
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
      prev.preferenceHintsByCellKey !== next.preferenceHintsByCellKey ||
      prev.showCellDiagnostics !== next.showCellDiagnostics
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
  rejectionHints,
  showCellDiagnostics,
}: ScheduleCellEditorProps) {
  const handleInputChange = React.useCallback(
    (newValue: string) => onCellValueChange(memberId, day, newValue),
    [day, memberId, onCellValueChange],
  );

  const handleCommit = React.useCallback(
    (newValue: string) => {
      const normalized = normalizeCellValue(newValue, shiftMode);
      onCellValueChange(memberId, day, normalized, { commit: true, source: "MANUAL" });
    },
    [day, memberId, onCellValueChange, shiftMode],
  );

  const handleBlur = React.useCallback(
    (rawValue: string) => {
      const normalized = normalizeCellValue(rawValue, shiftMode);
      onCellValueChange(memberId, day, normalized, { commit: true, source: "MANUAL" });
    },
    [day, memberId, onCellValueChange, shiftMode],
  );

  const missingEnd = shiftMode === "FULL" && hasStartWithoutEndValue(value);
  const diagnosticHints = showCellDiagnostics ? hints : undefined;
  const maxShiftHints = showCellDiagnostics ? (rejectionHints ?? []) : [];
  const hasConflict = diagnosticHints
    ? hasNegativePreferenceConflict({
        value,
        hints: diagnosticHints,
        shiftMode,
      })
    : false;
  const preferenceAssignmentBadge =
    source === "AUTO_BUILD"
      ? getAutoBuildPreferenceAssignmentBadge({
          value,
          hints: diagnosticHints ?? [],
          shiftMode,
        })
      : null;
  const conflictLabel =
    preferenceAssignmentBadge?.status === "SOFT_NEGATIVE_FALLBACK" ||
    preferenceAssignmentBadge?.status === "HARD_NEGATIVE_FALLBACK"
      ? preferenceAssignmentBadge.title
      : "Заполненная смена конфликтует с пожеланием сотрудника";

  const sourceMeta = showCellDiagnostics ? getScheduleCellSourceMeta(source) : null;
  const sourceEditHint =
    showCellDiagnostics && !readOnly && value.trim() && source && source !== "MANUAL"
      ? getScheduleCellSourceEditHint(source)
      : null;

  return (
    <div
      className={[
        "border-subtle border-b border-l",
        scheduleZoomCss.cellPadding,
        "text-[max(0.7rem,calc(0.875rem*var(--schedule-zoom)))]",
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

      {value.trim() && sourceMeta && (
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <span
            className={[
              "rounded-full border font-semibold",
              scheduleZoomCss.badgePadding,
              scheduleZoomCss.badgeText,
              sourceMeta.className,
            ].join(" ")}
            aria-label={sourceMeta.title}
            title={sourceMeta.title}
          >
            {sourceMeta.label}
          </span>
          {sourceEditHint && (
            <span className={["text-muted text-center leading-tight", scheduleZoomCss.badgeText].join(" ")}>
              {sourceEditHint}
            </span>
          )}
        </div>
      )}
      {maxShiftHints.length > 0 && diagnosticHints && diagnosticHints.length > 0 && !value.trim() && (
        <div className="mt-1 flex justify-center">
          <span
            className={[
              "rounded-full border border-sky-200 bg-sky-50 font-semibold text-sky-800",
              scheduleZoomCss.badgePadding,
              scheduleZoomCss.badgeText,
            ].join(" ")}
            title={maxShiftHints.map((hint) => hint.message).join("; ")}
          >
            Лимит смен
          </span>
        </div>
      )}
      {(hasConflict || preferenceAssignmentBadge) && (
        <div className="mt-1 flex justify-center">
          <span
            className={[
              "rounded-full border font-semibold",
              scheduleZoomCss.badgePadding,
              scheduleZoomCss.badgeText,
              preferenceAssignmentBadge?.className ?? "border-amber-300 bg-amber-100 text-amber-900",
            ].join(" ")}
            aria-label={preferenceAssignmentBadge?.title ?? conflictLabel}
            title={preferenceAssignmentBadge?.title ?? conflictLabel}
          >
            {preferenceAssignmentBadge?.label ?? "Конфликт"}
          </span>
        </div>
      )}
      {diagnosticHints && diagnosticHints.length > 0 && (
        <div className="mt-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))] flex flex-wrap gap-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))]">
          {diagnosticHints.map((cell) => {
            const label = getPreferenceHintLabel(cell.type);
            const note = cell.note?.trim() || null;
            const timeLabel = formatPreferenceHintTime(cell);
            const canApply = canApplyPreferenceHint({ readOnly, shiftMode, cell });
            return (
              <div
                key={`${cell.id ?? `${cell.day}:${cell.sortOrder}`}:${cell.type}`}
                className="flex items-center gap-[max(0.15rem,calc(0.25rem*var(--schedule-zoom)))]"
              >
                <span
                  title={note ?? undefined}
                  className={[
                    "rounded border",
                    scheduleZoomCss.badgePadding,
                    scheduleZoomCss.badgeText,
                    getPreferenceHintTone(cell.type) === "positive"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  ].join(" ")}
                >
                  {`${label} ${timeLabel}`.trim()}
                  {note ? " i" : ""}
                </span>
                {canApply && (
                  <button
                    type="button"
                    className={[
                      "border-subtle bg-surface text-muted hover:bg-app rounded border",
                      scheduleZoomCss.badgePadding,
                      scheduleZoomCss.badgeText,
                    ].join(" ")}
                    aria-label={`${value.trim() ? "Заменить смену на пожелание" : "Применить пожелание"} ${timeLabel}`}
                    title={`${value.trim() ? "Заменить смену на пожелание" : "Применить пожелание"} ${timeLabel}`}
                    onClick={() =>
                      onCellValueChange(memberId, day, `${cell.startTime}-${cell.endTime}`, {
                        commit: true,
                        source: "PREFERENCE_HINT",
                      })
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

function getScheduleCellSourceMeta(
  source?: ScheduleCellSource,
): { label: string; title: string; className: string } | null {
  switch (source) {
    case "AUTO_BUILD":
      return {
        label: "Авто",
        title: "Смена создана автосборкой",
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "PREFERENCE_HINT":
      return {
        label: "Пожелание",
        title: "Смена применена из пожелания сотрудника",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "MANUAL":
    default:
      return null;
  }
}

function getScheduleCellSourceEditHint(source?: ScheduleCellSource): string | null {
  switch (source) {
    case "AUTO_BUILD":
    case "PREFERENCE_HINT":
      return "Измените — станет ручной";
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
          "border-subtle bg-surface border-r border-b",
          scheduleZoomCss.headerPaddingX,
          "py-[max(0.45rem,calc(0.75rem*var(--schedule-zoom)))]",
          "text-strong font-semibold",
          scheduleZoomCss.memberText,
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
    <div className={["border-subtle border-b border-l", scheduleZoomCss.cellPadding].join(" ")}>
      <div
        className={[
          "bg-surface text-strong flex items-center justify-center text-center leading-tight font-semibold",
          scheduleZoomCss.readonlyShell,
        ].join(" ")}
      >
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
          className="bg-app text-strong focus:bg-surface ring-default h-[max(1.8rem,calc(2.5rem*var(--schedule-zoom)))] w-full rounded-[max(0.4rem,calc(0.5rem*var(--schedule-zoom)))] border border-transparent px-[max(0.25rem,calc(0.5rem*var(--schedule-zoom)))] text-center text-[max(0.75rem,calc(1rem*var(--schedule-zoom)))] focus:ring-2 focus:outline-none"
        />
      );
  }
}

function ReadonlyCell({ value, shiftMode }: { value: string; shiftMode: ShiftMode }) {
  if (!value) {
    return (
      <div
        className={[
          "bg-surface text-muted flex items-center justify-center text-center leading-tight",
          scheduleZoomCss.readonlyShell,
        ].join(" ")}
      >
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
      <div
        className={[
          "bg-surface text-strong flex flex-col items-center justify-center text-center leading-tight",
          scheduleZoomCss.readonlyShell,
        ].join(" ")}
      >
        <span>{from}</span>
        {to && <span>{to}</span>}
      </div>
    );
  }

  return (
    <div
      className={[
        "bg-surface text-strong flex items-center justify-center text-center leading-tight",
        scheduleZoomCss.readonlyShell,
      ].join(" ")}
    >
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
    <div
      className={[
        "bg-surface text-strong flex flex-col items-center justify-center",
        scheduleZoomCss.editableShell,
      ].join(" ")}
    >
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
    <div
      className={[
        "bg-surface text-strong flex flex-col items-center justify-center",
        scheduleZoomCss.editableShell,
      ].join(" ")}
    >
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
      {showHighlight && (
        <span className={["font-medium text-amber-600", scheduleZoomCss.badgeText].join(" ")}>Укажите время ухода</span>
      )}
    </div>
  );
}

function TimeSelector({ value, onHourChange, onMinuteChange, highlight }: TimeSelectorProps) {
  const selectedHour = value.hour ?? "";
  const selectedMinute = value.hour === null ? "" : normalizeMinuteValue(value.hour, value.minute ?? 0);

  const baseClasses =
    "w-full border border-subtle bg-surface text-center focus:outline-none focus:ring-2 ring-default " +
    scheduleZoomCss.select;
  const highlightClasses = highlight ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200" : "";

  return (
    <div className={["flex w-full items-center justify-center", scheduleZoomCss.timeSelectorGap].join(" ")}>
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
