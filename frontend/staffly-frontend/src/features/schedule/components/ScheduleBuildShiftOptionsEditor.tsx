import React from "react";

import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import { SCHEDULE_BUILD_TIME_STEP_SECONDS, type ScheduleBuildPositionConfigDraft } from "../utils/buildTemplateDraft";

type Props = {
  config: ScheduleBuildPositionConfigDraft;
  saving: boolean;
  onChange: (next: ScheduleBuildPositionConfigDraft) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const ScheduleBuildShiftOptionsEditor: React.FC<Props> = ({ config, saving, onChange, onAdd, onRemove }) => (
  <div className="space-y-2">
    <div>
      <div className="text-sm font-medium">Варианты смен</div>
      <div className="text-muted text-xs">Автосборка назначает сотрудникам только эти варианты смен.</div>
    </div>
    {config.shiftOptions.map((option, optionIndex) => (
      <div key={optionIndex} className="border-subtle grid grid-cols-2 gap-2 rounded-xl border p-2">
        <Input
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          label="С"
          value={option.startTime}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              shiftOptions: config.shiftOptions.map((item, idx) =>
                idx === optionIndex ? { ...item, startTime: e.target.value } : item,
              ),
            })
          }
        />
        <Input
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          label="По"
          value={option.endTime}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              shiftOptions: config.shiftOptions.map((item, idx) =>
                idx === optionIndex ? { ...item, endTime: e.target.value } : item,
              ),
            })
          }
        />
        <Input
          label="Название"
          value={option.label}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              shiftOptions: config.shiftOptions.map((item, idx) =>
                idx === optionIndex ? { ...item, label: e.target.value } : item,
              ),
            })
          }
        />
        <label className="mt-8 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={option.isFullShift}
            disabled={saving}
            onChange={(e) =>
              onChange({
                ...config,
                shiftOptions: config.shiftOptions.map((item, idx) =>
                  idx === optionIndex ? { ...item, isFullShift: e.target.checked } : item,
                ),
              })
            }
          />
          Полная смена
        </label>
        <Button variant="outline" disabled={saving} onClick={() => onRemove(optionIndex)}>
          Удалить смену
        </Button>
      </div>
    ))}
    <Button variant="outline" disabled={saving} onClick={onAdd}>
      Добавить смену
    </Button>
  </div>
);

export default ScheduleBuildShiftOptionsEditor;
