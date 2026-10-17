import React from "react";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import type { CommonSchedule } from "../api";
import { daysBetween, formatDayNumber, formatWeekdayShort, getTodayInTimeZone } from "../../schedule/utils/date";
import { scheduleRowCellKey, scheduleRowKey } from "../../schedule/utils/rowIdentity";
import { normalizeCellValue } from "../../schedule/utils/cellFormatting";
import { commonScheduleTodaySources, formatScheduleDate } from "../utils";
import CommonScheduleShift from "./CommonScheduleShift";
import { useScheduleTableZoom } from "../../schedule/hooks/useScheduleTableZoom";
import ScheduleTableZoomControls from "../../schedule/components/ScheduleTableZoomControls";

type Props = {
  schedule: CommonSchedule;
  downloadControl?: React.ReactNode;
  timeZone: string;
  refreshing: boolean;
  canManage: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onEdit: () => void;
};

export default function CommonScheduleView({
  schedule,
  downloadControl,
  timeZone,
  refreshing,
  canManage,
  onBack,
  onRefresh,
  onEdit,
}: Props) {
  const [tab, setTab] = React.useState<"table" | "today">("table");
  const tableZoom = useScheduleTableZoom();
  const tableRef = React.useRef<HTMLTableElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const fitTable = () => {
    if (!tableRef.current || !viewportRef.current) return;
    const fullWidth = tableRef.current.getBoundingClientRect().width / tableZoom.zoomScale;
    if (fullWidth <= 0) return;
    const percent =
      Math.floor(((viewportRef.current.clientWidth / fullWidth) * 100) / tableZoom.zoomStep) * tableZoom.zoomStep;
    tableZoom.setZoom(Math.min(100, percent));
  };
  const { summary, sources } = schedule;
  const days = daysBetween(summary.startDate, summary.endDate);
  const today = getTodayInTimeZone(timeZone);
  const todaysSources = commonScheduleTodaySources(sources, today);
  const hasShifts = todaysSources.some((s) => s.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          К общим графикам
        </Button>
        <div className="flex flex-wrap gap-2">
          {downloadControl}
          <Button variant="outline" onClick={onRefresh} isLoading={refreshing}>
            Обновить
          </Button>
          {canManage && (
            <Button variant="outline" onClick={onEdit}>
              Настройки
            </Button>
          )}
        </div>
      </div>
      <Card className="space-y-2">
        <h1 className="text-strong text-2xl font-semibold break-words">{summary.title}</h1>
        <p className="text-muted text-sm">
          Общий график · {formatScheduleDate(summary.startDate)} — {formatScheduleDate(summary.endDate)} · Только
          просмотр
        </p>
        <p className="text-muted text-sm">
          Данные обновляются из исходных графиков каждые 30 секунд и при возвращении на страницу.
        </p>
        {canManage && (
          <p className="text-muted text-sm">
            {summary.visibleToPositions ? "Доступен сотрудникам выбранных должностей" : "Доступен только Manager+"}
          </p>
        )}
      </Card>
      <div role="tablist" aria-label="Общий график" className="border-subtle flex gap-2 border-b">
        {(
          [
            ["table", "График"],
            ["today", "Смена сегодня"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 text-sm font-medium ${tab === value ? "text-strong border-b-2 border-current" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "today" ? (
        <Card className="space-y-4">
          <h2 className="text-strong font-semibold">Сегодня, {formatScheduleDate(today)}</h2>
          {!hasShifts && <p className="text-muted text-sm">На сегодня смен нет.</p>}
          {todaysSources
            .filter((s) => s.rows.length)
            .map(({ source, rows }) => (
              <div key={source.id} className="space-y-2">
                <h3 className="text-strong font-medium break-words">{source.title}</h3>
                {rows.map((row) => (
                  <p key={scheduleRowKey(row)} className="text-default text-sm">
                    {row.displayName} · {row.positionName ?? "Без должности"}
                    {row.historical ? " · Историческая строка" : ""} —{" "}
                    {normalizeCellValue(
                      source.content.cellValues[scheduleRowCellKey(row, today)],
                      source.content.config.shiftMode,
                    )}
                  </p>
                ))}
              </div>
            ))}
        </Card>
      ) : (
        <div className="space-y-3">
          <ScheduleTableZoomControls {...tableZoom} showFullPeriod={fitTable} />
          <div
            ref={viewportRef}
            className="border-subtle max-h-[70dvh] overflow-auto rounded-2xl border"
            tabIndex={0}
            role="region"
            aria-label="Таблица общего графика"
          >
            <table
              ref={tableRef}
              className="common-schedule-table text-default w-max border-separate border-spacing-0 text-xs"
              style={
                {
                  zoom: tableZoom.zoomScale,
                  WebkitTextSizeAdjust: "none",
                  textSizeAdjust: "none",
                  "--common-grid-line": `${1 / tableZoom.zoomScale}px`,
                } as React.CSSProperties
              }
              data-common-schedule-table-zoom={tableZoom.zoom}
            >
              <caption className="sr-only">{summary.title}, общий график с группировкой по исходным графикам</caption>
              <thead>
                <tr className="bg-surface">
                  <th
                    scope="col"
                    className="border-subtle bg-surface sticky top-0 left-0 z-40 w-px border-r border-b px-2 py-1 text-left"
                  >
                    <span className="block">Сотрудник</span>
                    <span className="text-muted block font-normal">Должность</span>
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      className={`border-subtle sticky top-0 z-30 min-w-10 border-b border-l px-1 py-1 ${day === today ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : "bg-surface"}`}
                    >
                      <span className="block">{formatDayNumber(day)}</span>
                      <span className="text-xs">{formatWeekdayShort(day)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              {sources.map((source) => (
                <tbody key={source.id}>
                  <tr>
                    <th
                      colSpan={days.length + 1}
                      scope="rowgroup"
                      className="bg-app border-subtle relative h-6 border-y p-0 text-left"
                    >
                      <div
                        className="absolute inset-0 overflow-hidden px-2 text-xs leading-6 whitespace-nowrap"
                        title={`${source.title} · ${formatScheduleDate(source.content.config.startDate)} — ${formatScheduleDate(source.content.config.endDate)}`}
                      >
                        <span className="sticky left-2 inline-block">
                          {source.title}
                          <span className="text-muted ml-2 font-normal">
                            {formatScheduleDate(source.content.config.startDate)} —{" "}
                            {formatScheduleDate(source.content.config.endDate)}
                          </span>
                        </span>
                      </div>
                    </th>
                  </tr>
                  {source.content.rows.length === 0 && (
                    <tr>
                      <td colSpan={days.length + 1} className="text-muted px-2 py-1">
                        В графике нет сотрудников.
                      </td>
                    </tr>
                  )}
                  {source.content.rows.map((row) => (
                    <tr key={scheduleRowKey(row)}>
                      <th
                        scope="row"
                        className="border-subtle bg-surface sticky left-0 z-20 w-px border-r border-b px-2 py-1 text-left font-normal whitespace-nowrap"
                        title={row.historical ? "Историческая строка" : undefined}
                      >
                        <span className="block">{row.displayName}</span>
                        <span className="text-muted block text-[11px]">
                          {row.positionName ?? "Без должности"}
                          {row.historical && <span className="sr-only"> · История</span>}
                        </span>
                      </th>
                      {days.map((day) => {
                        const outside = day < source.content.config.startDate || day > source.content.config.endDate;
                        const value = source.content.cellValues[scheduleRowCellKey(row, day)] ?? "";
                        return (
                          <td
                            key={day}
                            className={`border-subtle border-b border-l px-1 py-1 text-center whitespace-nowrap ${outside ? "bg-app text-muted" : "bg-surface"}`}
                            title={outside ? "Вне периода графика" : undefined}
                          >
                            {outside ? (
                              <>
                                <span aria-hidden="true">—</span>
                                <span className="sr-only">Вне периода графика</span>
                              </>
                            ) : (
                              <CommonScheduleShift value={value} mode={source.content.config.shiftMode} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
