import React from "react";
import type { MasterScheduleCellDto, MasterScheduleRowDto } from "../types";
import { formatDayLabel } from "../utils/date";
import { calcCellAmount, calcRowAmount } from "../utils/calc";
import Icon from "../../../shared/ui/Icon";
import { Minus, Plus, Settings } from "lucide-react";
import { useGridNavigation } from "../../../shared/ui/gridNavigation/useGridNavigation";

type Props = {
  rows: MasterScheduleRowDto[];
  cells: MasterScheduleCellDto[];
  dates: string[];
  mode: "DETAILED" | "COMPACT";
  onCellChange: (rowId: number, date: string, value: string) => void;
  onAddRow: (positionId: number) => void;
  onDeleteRow: (rowId: number) => void;
  onOpenSettings: (row: MasterScheduleRowDto) => void;
};

type GroupedRows = {
  positionId: number;
  positionName: string;
  rows: MasterScheduleRowDto[];
};

export default function MasterScheduleTableView({
  rows,
  cells,
  dates,
  mode,
  onCellChange,
  onAddRow,
  onDeleteRow,
  onOpenSettings,
}: Props) {
  const cellMap = React.useMemo(() => {
    const map = new Map<string, MasterScheduleCellDto>();
    cells.forEach((cell) => {
      map.set(`${cell.rowId}:${cell.workDate}`, cell);
    });
    return map;
  }, [cells]);

  const grouped = React.useMemo<GroupedRows[]>(() => {
    const map = new Map<number, GroupedRows>();
    rows.forEach((row) => {
      const existing = map.get(row.positionId) ?? {
        positionId: row.positionId,
        positionName: row.positionName,
        rows: [],
      };
      existing.rows.push(row);
      map.set(row.positionId, existing);
    });
    return Array.from(map.values()).map((group) => ({
      ...group,
      rows: group.rows.sort((a, b) => a.rowIndex - b.rowIndex),
    }));
  }, [rows]);

  // Navigation order must match the rendered (grouped + sorted) rows.
  const flattenedRows = React.useMemo(() => grouped.flatMap((group) => group.rows), [grouped]);

  const columnTotals = React.useMemo(() => {
    return dates.map((date) =>
      rows.reduce((sum, row) => {
        const cell = cellMap.get(`${row.id}:${date}`);
        return sum + calcCellAmount(row, cell);
      }, 0)
    );
  }, [dates, rows, cellMap]);

  const totalPayroll = React.useMemo(() => {
    return rows.reduce((sum, row) => {
      const rowCells = dates
        .map((date) => cellMap.get(`${row.id}:${date}`))
        .filter(Boolean) as MasterScheduleCellDto[];
      return sum + calcRowAmount(row, rowCells).amount;
    }, 0);
  }, [rows, dates, cellMap]);

  const rowIndexMap = React.useMemo(() => {
    return new Map(flattenedRows.map((row, index) => [row.id, index]));
  }, [flattenedRows]);

  const { registerCellRef, onCellKeyDown } = useGridNavigation({
    rows: flattenedRows,
    cols: dates,
    getCellId: (row, date) => `${row.id}:${date}`,
    wrapTab: true,
  });

  return (
    <div className="overflow-auto rounded-3xl border border-zinc-200 bg-white">
      <table className="min-w-full border-separate border-spacing-0 text-sm break-words">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Должность
            </th>
            {dates.map((date) => {
              const { weekday, isFriday, isSaturday, isMonday } = formatDayLabel(date);
              return (
                <th
                  key={`weekday-${date}`}
                  className={`sticky top-0 z-10 border-b border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
                    isFriday || isSaturday ? "bg-orange-50" : "bg-white"
                  } ${isMonday ? "border-l-2 border-zinc-200" : "border-l border-zinc-100"}`}
                >
                  {weekday}
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky left-0 top-8 z-20 bg-white px-4 py-2 text-left text-xs font-medium text-zinc-400">
              Строки
            </th>
            {dates.map((date) => {
              const { day, month, isFriday, isSaturday, isMonday } = formatDayLabel(date);
              return (
                <th
                  key={`day-${date}`}
                  className={`sticky top-8 z-10 border-b border-zinc-200 px-3 py-2 text-center text-xs font-medium text-zinc-500 ${
                    isFriday || isSaturday ? "bg-orange-50" : "bg-white"
                  } ${isMonday ? "border-l-2 border-zinc-200" : "border-l border-zinc-100"}`}
                >
                  {day}.{month}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {grouped.map((group) => {
            const groupTotals = dates.map((date) =>
              group.rows.reduce((sum, row) => {
                const cell = cellMap.get(`${row.id}:${date}`);
                return sum + calcCellAmount(row, cell);
              }, 0)
            );
            const groupRowTotal = group.rows.reduce((sum, row) => {
              const rowCells = dates
                .map((date) => cellMap.get(`${row.id}:${date}`))
                .filter(Boolean) as MasterScheduleCellDto[];
              return sum + calcRowAmount(row, rowCells).amount;
            }, 0);

            return (
              <React.Fragment key={group.positionId}>
                {group.rows.map((row, index) => {
                const rowCells = dates.map((date) => cellMap.get(`${row.id}:${date}`));
                const rowTotal = calcRowAmount(
                  row,
                  rowCells.filter(Boolean) as MasterScheduleCellDto[]
                );
                const isLast = index === group.rows.length - 1;
                return (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="sticky left-0 z-10 border-r border-zinc-100 bg-white px-4 py-3 break-words">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-900">
                            {group.positionName}
                            {mode === "DETAILED" && ` ${row.rowIndex}`}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {row.payType === "SALARY" ? "Оклад" : row.payType === "SHIFT" ? "Смены" : "Часы"}
                          </div>
                          <div className="text-xs text-zinc-400">
                            Итого: {rowTotal.units.toFixed(2)} · {rowTotal.amount.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
                            onClick={() => onOpenSettings(row)}
                          >
                            <Icon icon={Settings} size="xs" />
                          </button>
                          {mode === "DETAILED" && isLast && (
                            <button
                              type="button"
                              className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
                              onClick={() => onDeleteRow(row.id)}
                            >
                              <Icon icon={Minus} size="xs" />
                            </button>
                          )}
                        </div>
                      </div>
                      {mode === "DETAILED" && isLast && (
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                          onClick={() => onAddRow(group.positionId)}
                        >
                          <Icon icon={Plus} size="xs" /> Добавить строку
                        </button>
                      )}
                    </td>
                    {dates.map((date, colIndex) => {
                      const cell = cellMap.get(`${row.id}:${date}`);
                      const { isFriday, isSaturday, isMonday } = formatDayLabel(date);
                      const rowIndex = rowIndexMap.get(row.id) ?? 0;
                      const cellId = `${row.id}:${date}`;
                      return (
                        <td
                          key={cellId}
                          className={`border-l border-zinc-100 px-2 py-2 ${
                            isFriday || isSaturday ? "bg-orange-50" : "bg-white"
                          } ${isMonday ? "border-l-2 border-zinc-200" : ""}`}
                        >
                          <input
                            className="w-full rounded-xl border border-zinc-200 bg-transparent px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                            value={cell?.valueRaw ?? ""}
                            onChange={(e) => onCellChange(row.id, date, e.target.value)}
                            ref={registerCellRef(cellId)}
                            onKeyDown={(e) =>
                              onCellKeyDown(e, { rowIndex, colIndex, cellId })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
                })}
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <td className="sticky left-0 z-10 border-r border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                    Итого: {group.positionName}
                  </td>
                  {groupTotals.map((value, idx) => (
                    <td
                      key={`group-${group.positionId}-${dates[idx]}`}
                      className="border-l border-zinc-100 px-2 py-2 text-center text-sm font-medium text-zinc-600"
                    >
                      {value.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <td className="sticky left-0 z-10 border-r border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
                    Итого по должности: {groupRowTotal.toFixed(2)}
                  </td>
                  {dates.map((date) => (
                    <td
                      key={`group-spacer-${group.positionId}-${date}`}
                      className="border-l border-zinc-100 bg-zinc-50 px-2 py-2"
                    />
                  ))}
                </tr>
              </React.Fragment>
            );
          })}
          <tr className="border-t border-zinc-200 bg-zinc-50">
            <td className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              Итог по дням
            </td>
            {columnTotals.map((value, index) => (
              <td
                key={`total-${dates[index]}`}
                className="border-l border-zinc-100 px-2 py-2 text-center text-sm font-medium text-zinc-700"
              >
                {value.toFixed(2)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-3 text-sm">
        <div className="text-zinc-500">Общий итог ФОТ</div>
        <div className="font-semibold text-zinc-900">{totalPayroll.toFixed(2)}</div>
      </div>
    </div>
  );
}
