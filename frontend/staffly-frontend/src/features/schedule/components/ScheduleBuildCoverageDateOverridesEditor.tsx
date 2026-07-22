import React from "react";

import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import type { ScheduleBuildPositionConfigDraft } from "../utils/buildTemplateDraft";

const formatTimeShort = (value?: string | null) => (value ? value.slice(0, 5) : "");
const getShiftLabel = (label: string, index: number) => (label.trim() ? label.trim() : `Смена ${index + 1}`);
const formatShiftRange = (startTime?: string | null, endTime?: string | null) =>
  `${formatTimeShort(startTime)}–${formatTimeShort(endTime)}`;

type Props = {
  config: ScheduleBuildPositionConfigDraft;
  saving: boolean;
  onChange: (next: ScheduleBuildPositionConfigDraft) => void;
};

const uniqueOverrideDates = (config: ScheduleBuildPositionConfigDraft) =>
  [...new Set(config.coverageDateOverrides.map((override) => override.date).filter(Boolean))].sort();

const ScheduleBuildCoverageDateOverridesEditor: React.FC<Props> = ({ config, saving, onChange }) => {
  const dates = uniqueOverrideDates(config);

  const upsertOverride = (date: string, shiftOptionIndex: number, requiredCount: number) => {
    const existingIndex = config.coverageDateOverrides.findIndex(
      (override) => override.date === date && override.shiftOptionId === shiftOptionIndex,
    );
    const nextOverride = { date, shiftOptionId: shiftOptionIndex, requiredCount };
    onChange({
      ...config,
      coverageDateOverrides:
        existingIndex === -1
          ? [...config.coverageDateOverrides, nextOverride]
          : config.coverageDateOverrides.map((override, index) => (index === existingIndex ? nextOverride : override)),
    });
  };

  return (
    <div className="space-y-3 rounded-xl bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Исключения по датам</div>
          <div className="text-muted text-xs">
            Если дата добавлена сюда, обычные правила недели для этой даты заменяются.
          </div>
        </div>
        <Button
          variant="outline"
          disabled={saving || config.shiftOptions.length === 0}
          onClick={() => {
            const date = new Date().toISOString().slice(0, 10);
            const nextDate = dates.includes(date) ? "" : date;
            if (!nextDate) return;
            onChange({
              ...config,
              coverageDateOverrides: [
                ...config.coverageDateOverrides,
                ...config.shiftOptions.map((_, shiftOptionIndex) => ({
                  date: nextDate,
                  shiftOptionId: shiftOptionIndex,
                  requiredCount: 0,
                })),
              ],
            });
          }}
        >
          Добавить дату
        </Button>
      </div>

      {dates.length === 0 ? (
        <div className="text-muted text-sm">Нет исключений.</div>
      ) : (
        dates.map((date) => (
          <div key={date} className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <Input
                label="Дата"
                type="date"
                value={date}
                disabled={saving}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  if (!nextDate) return;
                  onChange({
                    ...config,
                    coverageDateOverrides: config.coverageDateOverrides.map((override) =>
                      override.date === date ? { ...override, date: nextDate } : override,
                    ),
                  });
                }}
              />
              <Button
                variant="outline"
                disabled={saving}
                onClick={() =>
                  onChange({
                    ...config,
                    coverageDateOverrides: config.coverageDateOverrides.filter((override) => override.date !== date),
                  })
                }
              >
                Удалить дату
              </Button>
            </div>
            <div className="border-subtle overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <tbody>
                  {config.shiftOptions.map((shiftOption, shiftOptionIndex) => {
                    const override = config.coverageDateOverrides.find(
                      (item) => item.date === date && item.shiftOptionId === shiftOptionIndex,
                    );
                    return (
                      <tr key={shiftOptionIndex} className="border-subtle border-t first:border-t-0">
                        <th className="px-3 py-2 text-left align-middle font-normal">
                          <div className="font-medium">{getShiftLabel(shiftOption.label, shiftOptionIndex)}</div>
                          <div className="text-muted text-xs">
                            {formatShiftRange(shiftOption.startTime, shiftOption.endTime) || "—"}
                          </div>
                        </th>
                        <td className="w-28 px-3 py-2">
                          <Input
                            label={<span className="sr-only">Количество</span>}
                            min={0}
                            type="number"
                            value={String(override?.requiredCount ?? 0)}
                            disabled={saving}
                            onChange={(event) =>
                              upsertOverride(date, shiftOptionIndex, Math.max(0, Number(event.target.value) || 0))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ScheduleBuildCoverageDateOverridesEditor;
