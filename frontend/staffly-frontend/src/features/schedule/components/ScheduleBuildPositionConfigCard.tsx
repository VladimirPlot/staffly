import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import type { PositionDto } from "../../dictionaries/api";
import type { ScheduleBuildMinRestMode, ScheduleBuildTargetPattern } from "../api";
import {
  createShiftOptionDraft,
  SCHEDULE_BUILD_TIME_STEP_SECONDS,
  type ScheduleBuildPositionConfigDraft,
} from "../utils/buildTemplateDraft";
import ScheduleBuildCoverageRulesEditor from "./ScheduleBuildCoverageRulesEditor";
import ScheduleBuildShiftOptionsEditor from "./ScheduleBuildShiftOptionsEditor";

const minRestModes: { value: ScheduleBuildMinRestMode; label: string }[] = [
  { value: "SOFT", label: "Мягко" },
  { value: "STRICT", label: "Строго" },
];

const daysOfWeek = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 7, label: "Вс" },
];

const patterns: { value: ScheduleBuildTargetPattern; label: string }[] = [
  { value: "NONE", label: "Без шаблона" },
  { value: "TWO_TWO", label: "2/2" },
  { value: "THREE_THREE", label: "3/3" },
  { value: "FIVE_TWO", label: "5/2" },
];

type Props = {
  index: number;
  config: ScheduleBuildPositionConfigDraft;
  positions: PositionDto[];
  saving: boolean;
  onChange: (next: ScheduleBuildPositionConfigDraft) => void;
  onRemove: () => void;
};

const ScheduleBuildPositionConfigCard: React.FC<Props> = ({ index, config, positions, saving, onChange, onRemove }) => (
  <div className="border-subtle space-y-3 rounded-2xl border p-3">
    <div className="flex items-center justify-between">
      <h4 className="font-medium">Должность #{index + 1}</h4>
      <Button variant="outline" disabled={saving} onClick={onRemove}>
        Удалить
      </Button>
    </div>
    <DropdownSelect
      value={String(config.positionId)}
      disabled={saving}
      onChange={(e) => onChange({ ...config, positionId: e.target.value ? Number(e.target.value) : "" })}
    >
      <option value="">Выберите должность</option>
      {positions
        .filter((position) => position.active)
        .map((position) => (
          <option key={position.id} value={position.id}>
            {position.name}
          </option>
        ))}
    </DropdownSelect>
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium">Рабочий диапазон должности</div>
        <div className="text-muted text-xs">
          Это общий период, в рамках которого могут быть смены. Автосборка не назначает этот интервал автоматически.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="С"
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          value={config.fullShiftStart}
          disabled={saving}
          onChange={(e) => onChange({ ...config, fullShiftStart: e.target.value })}
        />
        <Input
          label="По"
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          value={config.fullShiftEnd}
          disabled={saving}
          onChange={(e) => onChange({ ...config, fullShiftEnd: e.target.value })}
        />
      </div>
    </div>
    <div className="space-y-1">
      <DropdownSelect
        value={config.targetPattern}
        disabled={saving}
        onChange={(e) => onChange({ ...config, targetPattern: e.target.value as ScheduleBuildTargetPattern })}
      >
        {patterns.map((pattern) => (
          <option key={pattern.value} value={pattern.value}>
            {pattern.label}
          </option>
        ))}
      </DropdownSelect>
      <div className="text-muted text-xs">
        Ограничение/ориентир для будущей автосборки. Если не уверены — оставьте «Без шаблона».
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Input
        label="Мин. отдых (ч)"
        type="number"
        value={String(config.minRestHours)}
        disabled={saving}
        onChange={(e) => onChange({ ...config, minRestHours: e.target.value === "" ? "" : Number(e.target.value) })}
      />
      <DropdownSelect
        label="Правило отдыха"
        value={config.minRestMode}
        disabled={saving}
        onChange={(e) => onChange({ ...config, minRestMode: e.target.value as ScheduleBuildMinRestMode })}
      >
        {minRestModes.map((mode) => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </DropdownSelect>
      <Input
        label="Макс. смен"
        type="number"
        value={String(config.maxShiftsPerPeriod)}
        disabled={saving}
        onChange={(e) =>
          onChange({ ...config, maxShiftsPerPeriod: e.target.value === "" ? "" : Number(e.target.value) })
        }
      />
    </div>

    <div className="space-y-2 rounded-xl bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Тяжёлые дни</div>
          <div className="text-muted text-xs">Учитываются как мягкий баланс при автосборке.</div>
        </div>
        <DropdownSelect
          value=""
          disabled={saving || config.heavyDaysOfWeek.length >= daysOfWeek.length}
          onChange={(e) => {
            const day = Number(e.target.value);
            if (day && !config.heavyDaysOfWeek.includes(day)) {
              onChange({ ...config, heavyDaysOfWeek: [...config.heavyDaysOfWeek, day].sort((a, b) => a - b) });
            }
          }}
        >
          <option value="">Добавить день</option>
          {daysOfWeek
            .filter((day) => !config.heavyDaysOfWeek.includes(day.value))
            .map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
        </DropdownSelect>
      </div>
      {config.heavyDaysOfWeek.length === 0 ? (
        <div className="text-muted text-sm">Нет</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {config.heavyDaysOfWeek.map((day) => (
            <span
              key={day}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-sm shadow-sm"
            >
              {daysOfWeek.find((item) => item.value === day)?.label ?? day}
              <button
                type="button"
                className="text-muted hover:text-danger"
                disabled={saving}
                onClick={() =>
                  onChange({ ...config, heavyDaysOfWeek: config.heavyDaysOfWeek.filter((item) => item !== day) })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>

    <ScheduleBuildShiftOptionsEditor
      config={config}
      saving={saving}
      onChange={onChange}
      onAdd={() => onChange({ ...config, shiftOptions: [...config.shiftOptions, createShiftOptionDraft()] })}
      onRemove={(shiftOptionIndex) => {
        const shiftOption = config.shiftOptions[shiftOptionIndex];
        onChange({
          ...config,
          shiftOptions: config.shiftOptions.filter((_, idx) => idx !== shiftOptionIndex),
          coverageRules: shiftOption
            ? config.coverageRules.filter(
                (rule) => rule.startTime !== shiftOption.startTime || rule.endTime !== shiftOption.endTime,
              )
            : config.coverageRules,
        });
      }}
    />

    <ScheduleBuildCoverageRulesEditor config={config} saving={saving} onChange={onChange} />
  </div>
);

export default ScheduleBuildPositionConfigCard;
