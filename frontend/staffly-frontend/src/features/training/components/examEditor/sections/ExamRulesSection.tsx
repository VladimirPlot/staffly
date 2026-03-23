import type { ChangeEvent } from "react";
import Input from "../../../../../shared/ui/Input";

type Props = {
  passPercent: number;
  timeLimitSec: number | "";
  attemptLimit: number | "";
  onPassPercentChange: (value: number) => void;
  onTimeLimitChange: (value: number | "") => void;
  onAttemptLimitChange: (value: number | "") => void;
};

export default function ExamRulesSection({
  passPercent,
  timeLimitSec,
  attemptLimit,
  onPassPercentChange,
  onTimeLimitChange,
  onAttemptLimitChange,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-default">Правила прохождения</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Проходной балл, %"
          type="number"
          min={1}
          max={100}
          value={passPercent}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onPassPercentChange(Number(event.target.value))}
        />

        <Input
          label="Таймер (сек)"
          type="number"
          min={1}
          value={timeLimitSec}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onTimeLimitChange(event.target.value === "" ? "" : Number(event.target.value))}
        />

        <Input
          label="Лимит попыток"
          type="number"
          min={1}
          value={attemptLimit}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onAttemptLimitChange(event.target.value === "" ? "" : Number(event.target.value))}
        />
      </div>
    </section>
  );
}
