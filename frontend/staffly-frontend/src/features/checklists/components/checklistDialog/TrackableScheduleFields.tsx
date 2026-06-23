import type { Dispatch, SetStateAction } from "react";

import DropdownSelect from "../../../../shared/ui/DropdownSelect";
import type { ChecklistPeriodicity } from "../../api";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45];

type TrackableScheduleFieldsProps = {
  periodicity: ChecklistPeriodicity | undefined;
  resetHour: number | "";
  resetMinute: number | "";
  resetDayOfWeek: number | "";
  resetDayOfMonth: number | "";
  submitting: boolean;
  setPeriodicity: Dispatch<SetStateAction<ChecklistPeriodicity | undefined>>;
  setResetHour: Dispatch<SetStateAction<number | "">>;
  setResetMinute: Dispatch<SetStateAction<number | "">>;
  setResetDayOfWeek: Dispatch<SetStateAction<number | "">>;
  setResetDayOfMonth: Dispatch<SetStateAction<number | "">>;
};

export default function TrackableScheduleFields({
  periodicity,
  resetHour,
  resetMinute,
  resetDayOfWeek,
  resetDayOfMonth,
  submitting,
  setPeriodicity,
  setResetHour,
  setResetMinute,
  setResetDayOfWeek,
  setResetDayOfMonth,
}: TrackableScheduleFieldsProps) {
  return (
    <>
      <div>
        <div className="text-default mb-1 text-sm">Периодичность</div>
        <DropdownSelect
          aria-label="Периодичность"
          className="w-full rounded-2xl p-2 text-base"
          value={periodicity ?? ""}
          onChange={(event) => setPeriodicity((event.target.value || undefined) as ChecklistPeriodicity | undefined)}
          disabled={submitting}
        >
          <option value="">Выберите периодичность</option>
          <option value="DAILY">Каждый день</option>
          <option value="WEEKLY">Каждую неделю</option>
          <option value="MONTHLY">Каждый месяц</option>
          <option value="MANUAL">Только вручную</option>
        </DropdownSelect>
      </div>

      {periodicity && periodicity !== "MANUAL" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-default mb-1 text-sm">Время сброса</div>
            <div className="flex gap-2">
              <DropdownSelect
                aria-label="Часы"
                className="w-full rounded-2xl p-2 text-base"
                value={resetHour}
                onChange={(event) => setResetHour(event.target.value === "" ? "" : Number(event.target.value))}
                disabled={submitting}
              >
                <option value="">Часы</option>
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour.toString().padStart(2, "0")}
                  </option>
                ))}
              </DropdownSelect>
              <DropdownSelect
                aria-label="Минуты"
                className="w-full rounded-2xl p-2 text-base"
                value={resetMinute}
                onChange={(event) => setResetMinute(event.target.value === "" ? "" : Number(event.target.value))}
                disabled={submitting}
              >
                <option value="">Минуты</option>
                {MINUTES.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute.toString().padStart(2, "0")}
                  </option>
                ))}
              </DropdownSelect>
            </div>
          </div>

          {periodicity === "WEEKLY" && (
            <div>
              <div className="text-default mb-1 text-sm">День недели</div>
              <DropdownSelect
                aria-label="День недели"
                className="w-full rounded-2xl p-2 text-base"
                value={resetDayOfWeek}
                onChange={(event) => setResetDayOfWeek(event.target.value ? Number(event.target.value) : "")}
                disabled={submitting}
              >
                <option value="">Выберите день недели</option>
                <option value={1}>Понедельник</option>
                <option value={2}>Вторник</option>
                <option value={3}>Среда</option>
                <option value={4}>Четверг</option>
                <option value={5}>Пятница</option>
                <option value={6}>Суббота</option>
                <option value={7}>Воскресенье</option>
              </DropdownSelect>
            </div>
          )}

          {periodicity === "MONTHLY" && (
            <div>
              <div className="text-default mb-1 text-sm">День месяца</div>
              <input
                type="number"
                min={1}
                max={31}
                className="border-subtle bg-surface text-default w-full rounded-2xl border p-2 text-base"
                value={resetDayOfMonth}
                onChange={(event) => setResetDayOfMonth(event.target.value ? Number(event.target.value) : "")}
                disabled={submitting}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
