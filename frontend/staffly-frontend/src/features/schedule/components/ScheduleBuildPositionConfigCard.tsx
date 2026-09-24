import React from "react";

import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import type { PositionDto } from "../../dictionaries/api";
import type { ScheduleBuildMinRestMode, ScheduleBuildTargetPattern } from "../api";
import {
  deleteWeekdayRegime,
  splitWeekdayRegime,
  type ScheduleBuildPositionConfigDraft,
} from "../utils/buildTemplateDraft";
import ScheduleBuildWeekdayRegimeEditor from "./ScheduleBuildWeekdayRegimeEditor";

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
  timeZone: string;
};

const ScheduleBuildPositionConfigCard: React.FC<Props> = ({
  index,
  config,
  positions,
  saving,
  onChange,
  onRemove,
  timeZone,
}) => {
  const [deleteRegimeIndex, setDeleteRegimeIndex] = React.useState<number | null>(null);
  const selectedPositions = positions.filter((position) => config.positionIds.includes(position.id));
  const availablePositions = positions.filter(
    (position) => position.active && !config.positionIds.includes(position.id),
  );
  const title =
    selectedPositions.length > 0
      ? selectedPositions.map((position) => position.name).join(" + ")
      : `Блок #${index + 1}`;

  return (
    <div className="border-subtle space-y-3 rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        <Button variant="outline" disabled={saving} onClick={onRemove}>
          Удалить
        </Button>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Должности в блоке</div>
        {selectedPositions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPositions.map((position) => (
              <span
                key={position.id}
                className="bg-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm"
              >
                {position.name}
                <button
                  type="button"
                  disabled={saving}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    onChange({ ...config, positionIds: config.positionIds.filter((id) => id !== position.id) })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <DropdownSelect
          value=""
          disabled={saving || availablePositions.length === 0}
          onChange={(e) =>
            onChange({
              ...config,
              positionIds: e.target.value
                ? [...config.positionIds, Number(e.target.value)].sort((a, b) => a - b)
                : config.positionIds,
            })
          }
        >
          <option value="">Добавить должность</option>
          {availablePositions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </DropdownSelect>
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

      <div className="space-y-4">
        {config.weekdayRegimes.map((regime, regimeIndex) => (
          <React.Fragment key={regime.key}>
            {regimeIndex > 0 && <div className="border-subtle border-t" />}
            <ScheduleBuildWeekdayRegimeEditor
              regime={regime}
              saving={saving}
              canDelete={regimeIndex > 0}
              timeZone={timeZone}
              onDaysCommit={(days) =>
                onChange({ ...config, weekdayRegimes: splitWeekdayRegime(config.weekdayRegimes, regimeIndex, days) })
              }
              onChange={(next) =>
                onChange({
                  ...config,
                  weekdayRegimes: config.weekdayRegimes.map((item, itemIndex) =>
                    itemIndex === regimeIndex ? next : item,
                  ),
                })
              }
              onDelete={() => setDeleteRegimeIndex(regimeIndex)}
            />
          </React.Fragment>
        ))}
      </div>
      <ConfirmDialog
        open={deleteRegimeIndex !== null}
        title="Удалить режим?"
        description="Настройки этого режима будут потеряны. Дни режима вернутся в основной режим."
        confirmText="Удалить"
        cancelText="Отмена"
        tone="danger"
        onCancel={() => setDeleteRegimeIndex(null)}
        onConfirm={() => {
          if (deleteRegimeIndex !== null)
            onChange({
              ...config,
              weekdayRegimes: deleteWeekdayRegime(config.weekdayRegimes, deleteRegimeIndex),
            });
          setDeleteRegimeIndex(null);
        }}
      />
    </div>
  );
};

export default ScheduleBuildPositionConfigCard;
