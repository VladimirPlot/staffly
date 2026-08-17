import React from "react";

import Input from "../../../shared/ui/Input";
import type { ScheduleBuildCoverageRuleDraft, ScheduleBuildPositionConfigDraft } from "../utils/buildTemplateDraft";

const weekdays = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 7, label: "Вс" },
];

const getShiftLabel = (label: string, index: number) => (label.trim() ? label.trim() : `Смена ${index + 1}`);

const formatTimeShort = (value?: string | null) => {
  if (!value) return "";
  return value.slice(0, 5);
};

const formatShiftRange = (startTime?: string | null, endTime?: string | null) =>
  `${formatTimeShort(startTime)}–${formatTimeShort(endTime)}`;

const findRuleIndex = (
  coverageRules: ScheduleBuildCoverageRuleDraft[],
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) =>
  coverageRules.findIndex(
    (rule) => rule.dayOfWeek === dayOfWeek && rule.startTime === startTime && rule.endTime === endTime,
  );

type Props = {
  config: ScheduleBuildPositionConfigDraft;
  saving: boolean;
  onChange: (next: ScheduleBuildPositionConfigDraft) => void;
};

const ScheduleBuildCoverageRulesEditor: React.FC<Props> = ({ config, saving, onChange }) => {
  const handleRequiredCountChange = (shiftOptionIndex: number, dayOfWeek: number, rawValue: string) => {
    const shiftOption = config.shiftOptions[shiftOptionIndex];
    if (!shiftOption) return;

    const requiredCount = Math.max(0, Number(rawValue) || 0);
    const ruleIndex = findRuleIndex(config.coverageRules, dayOfWeek, shiftOption.startTime, shiftOption.endTime);

    if (requiredCount === 0) {
      if (ruleIndex === -1) return;
      onChange({
        ...config,
        coverageRules: config.coverageRules.filter((_, index) => index !== ruleIndex),
      });
      return;
    }

    if (ruleIndex === -1) {
      onChange({
        ...config,
        coverageRules: [
          ...config.coverageRules,
          {
            dayOfWeek,
            startTime: shiftOption.startTime,
            endTime: shiftOption.endTime,
            requiredCount,
            sortOrder: config.coverageRules.length,
          },
        ],
      });
      return;
    }

    onChange({
      ...config,
      coverageRules: config.coverageRules.map((rule, index) =>
        index === ruleIndex ? { ...rule, requiredCount } : rule,
      ),
    });
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium">Правила покрытия</div>
        <div className="text-muted text-xs">
          Укажите, сколько сотрудников требуется на каждый вариант смены по дням недели.
        </div>
      </div>
      {config.shiftOptions.length === 0 ? (
        <div className="text-muted text-sm">Добавьте варианты смен, чтобы настроить покрытие.</div>
      ) : (
        <div className="border-subtle overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="border-subtle w-40 border-b px-3 py-2 text-left font-medium">Смена</th>
                {weekdays.map((day) => (
                  <th key={day.value} className="border-subtle border-b px-1 py-2 text-center font-medium">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.shiftOptions.map((shiftOption, shiftOptionIndex) => (
                <tr key={shiftOptionIndex} className="border-subtle border-t">
                  <th className="w-40 px-3 py-2 text-left align-middle font-normal">
                    <div className="leading-tight font-medium">
                      {getShiftLabel(shiftOption.label, shiftOptionIndex)}
                    </div>
                    <div className="text-muted mt-0.5 text-xs leading-tight">
                      {formatShiftRange(shiftOption.startTime, shiftOption.endTime) || "—"}
                    </div>
                  </th>
                  {weekdays.map((day) => {
                    const rule = config.coverageRules.find(
                      (item) =>
                        item.dayOfWeek === day.value &&
                        item.startTime === shiftOption.startTime &&
                        item.endTime === shiftOption.endTime,
                    );

                    return (
                      <td key={day.value} className="px-1 py-2 text-center align-middle">
                        <Input
                          aria-label={`${getShiftLabel(shiftOption.label, shiftOptionIndex)} ${day.label}`}
                          className="mx-auto h-11 w-[72px] min-w-[72px] rounded-xl px-2 text-center text-sm"
                          label={<span className="sr-only">{day.label}</span>}
                          min={0}
                          type="number"
                          value={String(rule?.requiredCount ?? 0)}
                          disabled={saving || !shiftOption.startTime || !shiftOption.endTime}
                          onChange={(e) => handleRequiredCountChange(shiftOptionIndex, day.value, e.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScheduleBuildCoverageRulesEditor;
