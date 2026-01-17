import React from "react";
import type { MasterScheduleCellDto, MasterScheduleRowDto } from "../types";
import { calcRowAmount, normalizeCellValue } from "../utils/calc";

type Props = {
  rows: MasterScheduleRowDto[];
  cells: MasterScheduleCellDto[];
  date: string;
  onDateChange: (date: string) => void;
  onCellChange: (rowId: number, date: string, value: string) => void;
};

export default function MasterScheduleDayView({
  rows,
  cells,
  date,
  onDateChange,
  onCellChange,
}: Props) {
  const cellMap = React.useMemo(() => {
    const map = new Map<string, MasterScheduleCellDto>();
    cells.forEach((cell) => {
      map.set(`${cell.rowId}:${cell.workDate}`, cell);
    });
    return map;
  }, [cells]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4">
        <label className="block text-sm text-zinc-600">Дата</label>
        <input
          type="date"
          className="mt-2 w-full rounded-2xl border border-zinc-300 px-3 py-2"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const cell = cellMap.get(`${row.id}:${date}`);
          const units = normalizeCellValue(cell);
          const rowTotal = calcRowAmount(
            row,
            cell ? [cell] : []
          );
          return (
            <div
              key={row.id}
              className="rounded-3xl border border-zinc-200 bg-white p-4 break-words"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium text-zinc-900">
                    {row.positionName} {row.rowIndex > 1 ? row.rowIndex : ""}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {row.payType === "SALARY" ? "Оклад" : row.payType === "SHIFT" ? "Смены" : "Часы"}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {units.toFixed(2)} · {rowTotal.amount.toFixed(2)}
                </div>
              </div>
              <input
                className="mt-3 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-center"
                value={cell?.valueRaw ?? ""}
                onChange={(e) => onCellChange(row.id, date, e.target.value)}
                placeholder="Например, 5x12"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
