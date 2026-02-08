import React from "react";
import type { MasterScheduleWeekTemplateCellDto, Weekday } from "../types";
import type { PositionDto } from "../../dictionaries/api";
import { formatNumber } from "../utils/format";
import { comparePositions } from "../utils/positionSort";
import Icon from "../../../shared/ui/Icon";
import { Trash2 } from "lucide-react";

export type WeekTemplateDay = {
  label: string;
  weekday: Weekday;
};

type Props = {
  templateCells: MasterScheduleWeekTemplateCellDto[];
  positions: PositionDto[];
  days: WeekTemplateDay[];
  onCellChange: (
    positionId: number,
    weekday: Weekday,
    staffCount: number | null,
    units: number | null
  ) => void;
  onRemovePosition: (positionId: number) => void;
  onApplyTemplate: (overwriteExisting: boolean) => void;
};

export default function MasterScheduleWeekTemplateView({
  templateCells,
  positions,
  days,
  onCellChange,
  onRemovePosition,
  onApplyTemplate,
}: Props) {
  const cellMap = React.useMemo(() => {
    const map = new Map<string, MasterScheduleWeekTemplateCellDto>();
    templateCells.forEach((cell) => {
      map.set(`${cell.positionId}:${cell.weekday}`, cell);
    });
    return map;
  }, [templateCells]);

  const positionMap = React.useMemo(() => {
    return new Map(positions.map((pos) => [pos.id, pos]));
  }, [positions]);

  const positionIds = React.useMemo(() => {
    const ids = Array.from(new Set(templateCells.map((cell) => cell.positionId)));
    return ids.sort((a, b) => {
      return comparePositions(positionMap.get(a), positionMap.get(b));
    });
  }, [templateCells, positionMap]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
        Шаблон недели — черновик. Нажмите «Заполнить», чтобы применить его к детальному графику.
      </div>
      <div className="overflow-auto rounded-3xl border border-subtle bg-surface shadow-[var(--staffly-shadow)]">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-40 h-10 bg-surface px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Должность
              </th>
              {days.map((day) => (
                <th
                  key={`weekday-${day.weekday}`}
                  className="sticky top-0 z-30 h-10 border-l border-subtle bg-surface px-2 text-center text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positionIds.map((positionId) => {
              const position = positionMap.get(positionId);
              return (
                <tr key={positionId} className="border-b border-subtle">
                  <td className="sticky left-0 z-40 border-r border-subtle bg-surface px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-strong">
                          {position?.name ?? "Удаленная должность"}
                        </div>
                        <div className="text-xs text-muted">
                          {position?.payType === "SHIFT"
                            ? `Смена — ${formatNumber(position?.payRate ?? 0)}`
                            : `Часы — ${formatNumber(position?.payRate ?? 0)}/ч`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-xl border border-subtle bg-surface p-2 text-icon hover:bg-app"
                        onClick={() => onRemovePosition(positionId)}
                      >
                        <Icon icon={Trash2} size="xs" />
                      </button>
                    </div>
                  </td>
                  {days.map((day) => {
                    const cell = cellMap.get(`${positionId}:${day.weekday}`);
                    return (
                      <td
                        key={`${positionId}:${day.weekday}`}
                        className="border-l border-subtle px-2 py-2"
                      >
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className="w-full rounded-lg border border-subtle px-2 py-1 text-center text-xs outline-none focus:ring-2 ring-default"
                            placeholder="Кол-во"
                            value={cell?.staffCount ?? ""}
                            onChange={(e) =>
                              onCellChange(
                                positionId,
                                day.weekday,
                                e.target.value === "" ? null : Number(e.target.value),
                                cell?.units ?? null
                              )
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.25}
                            className="w-full rounded-lg border border-subtle px-2 py-1 text-center text-xs outline-none focus:ring-2 ring-default"
                            placeholder="Ед."
                            value={cell?.units ?? ""}
                            onChange={(e) =>
                              onCellChange(
                                positionId,
                                day.weekday,
                                cell?.staffCount ?? null,
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-strong">Заполнить детальный график</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-2xl border border-subtle bg-surface px-4 py-2 text-sm text-default hover:bg-app"
            onClick={() => onApplyTemplate(false)}
          >
            Заполнить только пустые
          </button>
          <button
            type="button"
            className="rounded-2xl border border-subtle bg-surface px-4 py-2 text-sm text-default hover:bg-app"
            onClick={() => onApplyTemplate(true)}
          >
            Перезаписать детальный график
          </button>
        </div>
      </div>
    </div>
  );
}
