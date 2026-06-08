import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import { SCHEDULE_BUILD_TIME_STEP_SECONDS, type ScheduleBuildPositionConfigDraft } from "../utils/buildTemplateDraft";

const dayOptions = [
  { value: 1, label: "1 — Пн" },
  { value: 2, label: "2 — Вт" },
  { value: 3, label: "3 — Ср" },
  { value: 4, label: "4 — Чт" },
  { value: 5, label: "5 — Пт" },
  { value: 6, label: "6 — Сб" },
  { value: 7, label: "7 — Вс" },
];

type Props = {
  config: ScheduleBuildPositionConfigDraft;
  saving: boolean;
  onChange: (next: ScheduleBuildPositionConfigDraft) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const ScheduleBuildCoverageRulesEditor: React.FC<Props> = ({ config, saving, onChange, onAdd, onRemove }) => (
  <div className="space-y-2">
    <div>
      <div className="text-sm font-medium">Правила покрытия</div>
      <div className="text-muted text-xs">
        В MVP каждое правило покрытия должно соответствовать одному варианту смены или покрываться одним вариантом
        смены. Если нужно поставить разные смены в один день, укажите количество по каждому варианту отдельно.
      </div>
    </div>
    {config.coverageRules.length === 0 && (
      <div className="text-muted text-sm">
        Правила покрытия можно добавить позже; без них автосборка не сможет рассчитать потребность.
      </div>
    )}
    {config.coverageRules.map((rule, ruleIndex) => (
      <div key={ruleIndex} className="border-subtle grid grid-cols-2 gap-2 rounded-xl border p-2">
        <DropdownSelect
          value={String(rule.dayOfWeek)}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              coverageRules: config.coverageRules.map((item, idx) =>
                idx === ruleIndex ? { ...item, dayOfWeek: Number(e.target.value) } : item,
              ),
            })
          }
        >
          {dayOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </DropdownSelect>
        <Input
          label="Требуется"
          type="number"
          value={String(rule.requiredCount)}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              coverageRules: config.coverageRules.map((item, idx) =>
                idx === ruleIndex ? { ...item, requiredCount: Number(e.target.value) } : item,
              ),
            })
          }
        />
        <Input
          label="С"
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          value={rule.startTime}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              coverageRules: config.coverageRules.map((item, idx) =>
                idx === ruleIndex ? { ...item, startTime: e.target.value } : item,
              ),
            })
          }
        />
        <Input
          label="По"
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          value={rule.endTime}
          disabled={saving}
          onChange={(e) =>
            onChange({
              ...config,
              coverageRules: config.coverageRules.map((item, idx) =>
                idx === ruleIndex ? { ...item, endTime: e.target.value } : item,
              ),
            })
          }
        />
        <Button variant="outline" disabled={saving} onClick={() => onRemove(ruleIndex)}>
          Удалить правило
        </Button>
      </div>
    ))}
    <Button variant="outline" disabled={saving} onClick={onAdd}>
      Добавить правило
    </Button>
  </div>
);

export default ScheduleBuildCoverageRulesEditor;
