import React from "react";
import { Trash2 } from "lucide-react";

import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Input from "../../../shared/ui/Input";
import type { DayOfWeek } from "../api";
import {
  createShiftOptionDraft,
  SCHEDULE_BUILD_TIME_STEP_SECONDS,
  type ScheduleBuildWeekdayRegimeDraft,
} from "../utils/buildTemplateDraft";
import ScheduleBuildCoverageDateOverridesEditor from "./ScheduleBuildCoverageDateOverridesEditor";
import ScheduleBuildCoverageRulesEditor from "./ScheduleBuildCoverageRulesEditor";
import ScheduleBuildShiftOptionsEditor from "./ScheduleBuildShiftOptionsEditor";
import ScheduleBuildWeekdaySelector from "./ScheduleBuildWeekdaySelector";

type Props = {
  regime: ScheduleBuildWeekdayRegimeDraft;
  saving: boolean;
  canDelete: boolean;
  onChange: (next: ScheduleBuildWeekdayRegimeDraft) => void;
  onDaysCommit: (days: DayOfWeek[]) => void;
  onDelete: () => void;
  timeZone: string;
};

const ScheduleBuildWeekdayRegimeEditor: React.FC<Props> = ({
  regime,
  saving,
  canDelete,
  onChange,
  onDaysCommit,
  onDelete,
  timeZone,
}) => (
  <section className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <ScheduleBuildWeekdaySelector days={regime.daysOfWeek} disabled={saving} onCommit={onDaysCommit} />
      {canDelete && (
        <IconButton
          disabled={saving}
          aria-label="Удалить режим"
          title="Удалить режим"
          className="shrink-0 text-red-600"
          onClick={onDelete}
        >
          <Icon icon={Trash2} size="sm" decorative />
        </IconButton>
      )}
    </div>
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium">Рабочий период</div>
        <div className="text-muted text-xs">Общий период смен в выбранные дни.</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="С"
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          value={regime.workPeriodStart}
          disabled={saving}
          onChange={(e) => onChange({ ...regime, workPeriodStart: e.target.value })}
        />
        <Input
          label="По"
          type="time"
          step={SCHEDULE_BUILD_TIME_STEP_SECONDS}
          value={regime.workPeriodEnd}
          disabled={saving}
          onChange={(e) => onChange({ ...regime, workPeriodEnd: e.target.value })}
        />
      </div>
    </div>
    <ScheduleBuildShiftOptionsEditor
      config={regime}
      saving={saving}
      onChange={onChange}
      onAdd={() => onChange({ ...regime, shiftOptions: [...regime.shiftOptions, createShiftOptionDraft()] })}
      onRemove={(optionIndex) => {
        const option = regime.shiftOptions[optionIndex];
        onChange({
          ...regime,
          shiftOptions: regime.shiftOptions.filter((_, index) => index !== optionIndex),
          coverageRules: option
            ? regime.coverageRules.filter(
                (rule) => rule.startTime !== option.startTime || rule.endTime !== option.endTime,
              )
            : regime.coverageRules,
          coverageDateOverrides: regime.coverageDateOverrides
            .filter((item) => item.shiftOptionIndex !== optionIndex)
            .map((item) => ({
              ...item,
              shiftOptionIndex: item.shiftOptionIndex > optionIndex ? item.shiftOptionIndex - 1 : item.shiftOptionIndex,
            })),
        });
      }}
    />
    <ScheduleBuildCoverageRulesEditor config={regime} saving={saving} onChange={onChange} />
    <ScheduleBuildCoverageDateOverridesEditor config={regime} saving={saving} onChange={onChange} timeZone={timeZone} />
  </section>
);

export default ScheduleBuildWeekdayRegimeEditor;
