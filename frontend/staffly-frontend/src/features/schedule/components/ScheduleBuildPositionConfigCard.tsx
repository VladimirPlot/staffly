import React from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import type { PositionDto } from "../../dictionaries/api";
import type { ScheduleBuildTargetPattern } from "../api";
import {
  createCoverageRuleDraft,
  createShiftOptionDraft,
  type ScheduleBuildPositionConfigDraft,
} from "../utils/buildTemplateDraft";
import ScheduleBuildCoverageRulesEditor from "./ScheduleBuildCoverageRulesEditor";
import ScheduleBuildShiftOptionsEditor from "./ScheduleBuildShiftOptionsEditor";

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
    <div className="grid grid-cols-2 gap-2">
      <Input
        label="Полная смена с"
        type="time"
        value={config.fullShiftStart}
        disabled={saving}
        onChange={(e) => onChange({ ...config, fullShiftStart: e.target.value })}
      />
      <Input
        label="по"
        type="time"
        value={config.fullShiftEnd}
        disabled={saving}
        onChange={(e) => onChange({ ...config, fullShiftEnd: e.target.value })}
      />
    </div>
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
    <div className="grid grid-cols-2 gap-2">
      <Input
        label="Мин. отдых (ч)"
        type="number"
        value={String(config.minRestHours)}
        disabled={saving}
        onChange={(e) => onChange({ ...config, minRestHours: e.target.value === "" ? "" : Number(e.target.value) })}
      />
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

    <ScheduleBuildShiftOptionsEditor
      config={config}
      saving={saving}
      onChange={onChange}
      onAdd={() => onChange({ ...config, shiftOptions: [...config.shiftOptions, createShiftOptionDraft()] })}
      onRemove={(shiftOptionIndex) =>
        onChange({ ...config, shiftOptions: config.shiftOptions.filter((_, idx) => idx !== shiftOptionIndex) })
      }
    />

    <ScheduleBuildCoverageRulesEditor
      config={config}
      saving={saving}
      onChange={onChange}
      onAdd={() => onChange({ ...config, coverageRules: [...config.coverageRules, createCoverageRuleDraft()] })}
      onRemove={(coverageRuleIndex) =>
        onChange({ ...config, coverageRules: config.coverageRules.filter((_, idx) => idx !== coverageRuleIndex) })
      }
    />
  </div>
);

export default ScheduleBuildPositionConfigCard;
