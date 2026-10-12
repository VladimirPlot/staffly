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
      <div className="text-default text-sm font-semibold">Правила прохождения</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Проходной балл, %"
          type="number"
          min={1}
          max={100}
          value={passPercent}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onPassPercentChange(Number(event.target.value))}
        />

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Время: минуты"
              type="number"
              min={0}
              step={1}
              value={timeLimitSec === "" ? "" : Math.floor(timeLimitSec / 60)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const minutes = Number(event.target.value);
                if (!Number.isSafeInteger(minutes) || minutes < 0) return;
                const total = minutes * 60 + (timeLimitSec === "" ? 0 : timeLimitSec % 60);
                onTimeLimitChange(total || "");
              }}
            />
            <Input
              label="Время: секунды"
              type="number"
              min={0}
              max={59}
              step={1}
              value={timeLimitSec === "" ? "" : timeLimitSec % 60}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const seconds = Number(event.target.value);
                if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 59) return;
                const total = (timeLimitSec === "" ? 0 : Math.floor(timeLimitSec / 60) * 60) + seconds;
                onTimeLimitChange(total || "");
              }}
            />
          </div>
          <p className="text-muted text-xs">Пустые поля или 0 минут и 0 секунд — без ограничения времени.</p>
        </div>

        <Input
          label="Лимит попыток"
          type="number"
          min={1}
          value={attemptLimit}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onAttemptLimitChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      </div>
    </section>
  );
}
