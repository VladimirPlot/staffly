import React from "react";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import type { CommonSchedule } from "../api";
import { daysBetween, formatDayNumber, formatWeekdayShort, getTodayInTimeZone } from "../../schedule/utils/date";
import { scheduleRowCellKey, scheduleRowKey } from "../../schedule/utils/rowIdentity";
import { normalizeCellValue } from "../../schedule/utils/cellFormatting";
import { commonScheduleTodaySources, formatScheduleDate } from "../utils";

type Props = {
  schedule: CommonSchedule;
  timeZone: string;
  refreshing: boolean;
  canManage: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onEdit: () => void;
};

export default function CommonScheduleView({
  schedule,
  timeZone,
  refreshing,
  canManage,
  onBack,
  onRefresh,
  onEdit,
}: Props) {
  const [tab, setTab] = React.useState<"table" | "today">("table");
  const { summary, sources } = schedule;
  const days = daysBetween(summary.startDate, summary.endDate);
  const today = getTodayInTimeZone(timeZone);
  const todaysSources = commonScheduleTodaySources(sources, today);
  const hasShifts = todaysSources.some((s) => s.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Ко всем графикам
        </Button>
        <div className="flex gap-2">
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
        <div className="border-subtle overflow-x-auto rounded-2xl border">
          <table className="text-default w-full border-collapse text-sm">
            <caption className="sr-only">{summary.title}, общий график с группировкой по исходным графикам</caption>
            <thead>
              <tr className="bg-surface">
                <th scope="col" className="border-subtle bg-surface sticky left-0 z-20 min-w-52 border-b p-3 text-left">
                  Сотрудник / должность
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className={`border-subtle min-w-20 border-b p-2 ${day === today ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : ""}`}
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
                    className="bg-app border-subtle border-b p-3 text-left"
                  >
                    <span className="sticky left-3 inline-block max-w-72 break-words">
                      {source.title}
                      <span className="text-muted block text-xs font-normal">
                        {formatScheduleDate(source.content.config.startDate)} —{" "}
                        {formatScheduleDate(source.content.config.endDate)}
                      </span>
                    </span>
                  </th>
                </tr>
                {source.content.rows.length === 0 && (
                  <tr>
                    <td colSpan={days.length + 1} className="text-muted p-3">
                      В графике нет сотрудников.
                    </td>
                  </tr>
                )}
                {source.content.rows.map((row) => (
                  <tr key={scheduleRowKey(row)}>
                    <th
                      scope="row"
                      className="border-subtle bg-surface sticky left-0 z-10 border-b p-3 text-left font-normal"
                    >
                      <span className="block max-w-64 break-words">{row.displayName}</span>
                      <span className="text-muted block text-xs">
                        {row.positionName ?? "Без должности"}
                        {row.historical ? " · История" : ""}
                      </span>
                    </th>
                    {days.map((day) => {
                      const outside = day < source.content.config.startDate || day > source.content.config.endDate;
                      const value = source.content.cellValues[scheduleRowCellKey(row, day)] ?? "";
                      return (
                        <td
                          key={day}
                          className={`border-subtle border-b border-l p-2 text-center whitespace-nowrap ${outside ? "bg-app text-muted" : "bg-surface"}`}
                          title={outside ? "Вне периода графика" : undefined}
                        >
                          {outside ? (
                            <>
                              <span aria-hidden="true">—</span>
                              <span className="sr-only">Вне периода графика</span>
                            </>
                          ) : (
                            normalizeCellValue(value, source.content.config.shiftMode)
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
      )}
    </div>
  );
}
