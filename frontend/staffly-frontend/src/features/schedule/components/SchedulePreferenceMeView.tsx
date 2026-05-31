import React from "react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import { formatDateFromIso } from "../../../shared/utils/date";
import type {
  SchedulePreferenceCellRequest,
  SchedulePreferenceMyResponse,
  SchedulePreferenceType,
  UpsertMySchedulePreferenceRequest,
} from "../api";
import { getScheduleStatusLabel } from "../utils/status";

type SchedulePreferenceMeViewProps = {
  data: SchedulePreferenceMyResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  message: string | null;
  onBack: () => void;
  onSubmit: (request: UpsertMySchedulePreferenceRequest) => void;
};

type PreferenceSelectValue = "" | SchedulePreferenceType;

type PreferenceFormValue = {
  type: PreferenceSelectValue;
  fullDay: boolean;
  startTime: string;
  endTime: string;
};

type PreferenceFormState = Record<string, PreferenceFormValue>;

const PREFERENCE_OPTIONS: { value: PreferenceSelectValue; label: string }[] = [
  { value: "", label: "Без пожелания" },
  { value: "AVAILABLE", label: "Могу" },
  { value: "UNAVAILABLE", label: "Не могу" },
  { value: "PREFER_DAY_OFF", label: "Хочу выходной" },
  { value: "PREFER_WORK", label: "Хочу работать" },
];

const QUICK_TIME_INTERVALS = [
  { startTime: "10:00", endTime: "00:00" },
  { startTime: "14:00", endTime: "00:00" },
  { startTime: "17:00", endTime: "00:00" },
  { startTime: "10:00", endTime: "17:00" },
] as const;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitialFormState(data: SchedulePreferenceMyResponse): PreferenceFormState {
  const result: PreferenceFormState = {};
  const sortedCells = [...data.cells].sort((a, b) => {
    if (a.day !== b.day) return a.day.localeCompare(b.day);
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return (a.id ?? 0) - (b.id ?? 0);
  });

  sortedCells.forEach((cell) => {
    result[cell.day] = {
      type: cell.type,
      fullDay: cell.fullDay,
      startTime: cell.fullDay ? "" : (cell.startTime ?? ""),
      endTime: cell.fullDay ? "" : (cell.endTime ?? ""),
    };
  });

  return result;
}

function buildReadonlyMessage(data: SchedulePreferenceMyResponse): string {
  if (data.status !== "COLLECTING_PREFERENCES") {
    return "Сбор закрыт. Отправка пожеланий больше недоступна.";
  }
  return "Срок отправки пожеланий истёк.";
}

function buildRepeatingPattern(
  days: SchedulePreferenceMyResponse["days"],
  workCount: number,
  offCount: number,
): PreferenceFormState {
  const result: PreferenceFormState = {};
  const cycleLength = workCount + offCount;

  days.forEach((day, index) => {
    const indexInCycle = index % cycleLength;
    result[day.date] = {
      type: indexInCycle < workCount ? "PREFER_WORK" : "PREFER_DAY_OFF",
      fullDay: true,
      startTime: "",
      endTime: "",
    };
  });

  return result;
}

function buildWeekdayPattern(days: SchedulePreferenceMyResponse["days"]): PreferenceFormState {
  const result: PreferenceFormState = {};

  days.forEach((day) => {
    const weekday = new Date(`${day.date}T00:00:00`).getDay();
    result[day.date] = {
      type: weekday >= 1 && weekday <= 5 ? "PREFER_WORK" : "PREFER_DAY_OFF",
      fullDay: true,
      startTime: "",
      endTime: "",
    };
  });

  return result;
}

function fillAll(
  days: SchedulePreferenceMyResponse["days"],
  type: Extract<PreferenceSelectValue, SchedulePreferenceType>,
): PreferenceFormState {
  const result: PreferenceFormState = {};
  days.forEach((day) => {
    result[day.date] = { type, fullDay: true, startTime: "", endTime: "" };
  });
  return result;
}

const SchedulePreferenceMeView: React.FC<SchedulePreferenceMeViewProps> = ({
  data,
  loading,
  saving,
  error,
  message,
  onBack,
  onSubmit,
}) => {
  const [formStateByDay, setFormStateByDay] = React.useState<PreferenceFormState>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (!data) {
      setFormStateByDay({});
      setFormError(null);
      setComment("");
      return;
    }

    setFormStateByDay(getInitialFormState(data));
    setFormError(null);
    setComment(data.comment ?? "");
  }, [data]);

  const handleSelectionChange = React.useCallback((day: string, value: string) => {
    setFormError(null);
    setFormStateByDay((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? { type: "", fullDay: true, startTime: "", endTime: "" }),
        type: value as PreferenceSelectValue,
        fullDay: value ? (prev[day]?.fullDay ?? true) : true,
      },
    }));
  }, []);

  const handleUseTimeToggle = React.useCallback((day: string, checked: boolean) => {
    setFormError(null);
    setFormStateByDay((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? { type: "", fullDay: true, startTime: "", endTime: "" }),
        fullDay: !checked,
      },
    }));
  }, []);

  const handleTimeChange = React.useCallback((day: string, field: "startTime" | "endTime", value: string) => {
    setFormError(null);
    setFormStateByDay((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? { type: "", fullDay: false, startTime: "", endTime: "" }),
        [field]: value,
      },
    }));
  }, []);

  const handleQuickIntervalApply = React.useCallback((day: string, startTime: string, endTime: string) => {
    setFormError(null);
    setFormStateByDay((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? { type: "", fullDay: false, startTime: "", endTime: "" }),
        fullDay: false,
        startTime,
        endTime,
      },
    }));
  }, []);

  const handleSubmit = React.useCallback(() => {
    if (!data || !data.canSubmit) return;

    const cells: SchedulePreferenceCellRequest[] = [];

    for (const day of data.days) {
      const value = formStateByDay[day.date];
      const type = value?.type ?? "";
      if (!type) continue;

      if (!value.fullDay) {
        if (!value.startTime || !value.endTime) {
          setFormError(`Заполните время для ${formatDateFromIso(day.date)}.`);
          return;
        }
        if (value.startTime === value.endTime) {
          setFormError(`Время начала и окончания не должно совпадать (${formatDateFromIso(day.date)}).`);
          return;
        }
        if (value.endTime !== "00:00" && value.startTime >= value.endTime) {
          setFormError(`Время начала должно быть раньше окончания (${formatDateFromIso(day.date)}).`);
          return;
        }
      }

      cells.push({
        day: day.date,
        type,
        fullDay: value.fullDay,
        startTime: value.fullDay ? null : value.startTime,
        endTime: value.fullDay ? null : value.endTime,
        note: null,
      });
    }

    onSubmit({
      cells,
      comment: comment.trim().length > 0 ? comment.trim() : null,
    });
  }, [comment, data, formStateByDay, onSubmit]);

  const clearAll = React.useCallback(() => {
    setFormStateByDay({});
    setFormError(null);
  }, []);

  if (loading && !data) {
    return <Card>Загрузка пожеланий…</Card>;
  }

  if (!data) {
    return (
      <Card className="space-y-4">
        {error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="text-muted text-sm">Нет данных.</div>
        )}
        <Button variant="outline" onClick={onBack}>
          Назад к графикам
        </Button>
      </Card>
    );
  }

  const submitButtonLabel = data.submittedAt ? "Переотправить пожелания" : "Отправить пожелания";

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-strong text-xl font-semibold">Пожелания по графику</h2>
              <span className="border-subtle bg-surface text-muted rounded-full border px-2 py-0.5 text-xs font-medium">
                {getScheduleStatusLabel(data.status)}
              </span>
            </div>
            <div className="text-muted text-sm">{data.title}</div>
            <div className="text-default text-sm">
              Период: {formatDateFromIso(data.startDate)} — {formatDateFromIso(data.endDate)}
            </div>
            <div className="text-muted text-sm">Дедлайн: {formatDateTime(data.preferenceDeadline)}</div>
          </div>
          <Button variant="outline" onClick={onBack}>
            Назад к графикам
          </Button>
        </div>

        {data.submittedAt && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Пожелания отправлены: {formatDateTime(data.submittedAt)} · ревизия {data.revision}
          </div>
        )}

        {!data.canSubmit && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {buildReadonlyMessage(data)}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-[var(--staffly-border)] p-4">
          <h3 className="text-strong text-base font-semibold">Быстро заполнить</h3>
          <p className="text-muted text-sm">
            Выберите шаблон, а потом при необходимости поправьте отдельные дни вручную.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => setFormStateByDay(buildRepeatingPattern(data.days, 2, 2))}
            >
              2/2
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => setFormStateByDay(buildRepeatingPattern(data.days, 3, 3))}
            >
              3/3
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => setFormStateByDay(buildWeekdayPattern(data.days))}
            >
              5/2
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => setFormStateByDay(fillAll(data.days, "AVAILABLE"))}
            >
              Все дни могу
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => setFormStateByDay(fillAll(data.days, "UNAVAILABLE"))}
            >
              Все дни не могу
            </Button>
            <Button type="button" variant="outline" disabled={!data.canSubmit || saving} onClick={clearAll}>
              Очистить все
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-strong text-base font-semibold">Дни</h3>
          <p className="text-muted text-sm">
            Выберите пожелание на день. При необходимости можно указать конкретное время.
          </p>
        </div>

        <div className="divide-subtle overflow-hidden rounded-2xl border border-[var(--staffly-border)]">
          {data.days.map((day) => (
            <div
              key={day.date}
              className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] sm:items-center"
            >
              <div>
                <div className="text-default text-sm font-medium">{formatDateFromIso(day.date)}</div>
                <div className="text-muted text-xs">{day.weekdayLabel}</div>
              </div>
              <DropdownSelect
                aria-label={`Пожелание на ${formatDateFromIso(day.date)}`}
                value={formStateByDay[day.date]?.type ?? ""}
                onChange={(event) => handleSelectionChange(day.date, event.target.value)}
                disabled={!data.canSubmit || saving}
              >
                {PREFERENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DropdownSelect>
              {(formStateByDay[day.date]?.type ?? "") !== "" && (
                <div className="space-y-2 sm:col-start-2">
                  <label className="text-muted flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={!(formStateByDay[day.date]?.fullDay ?? true)}
                      onChange={(event) => handleUseTimeToggle(day.date, event.target.checked)}
                      disabled={!data.canSubmit || saving}
                    />
                    Указать время
                  </label>
                  {!(formStateByDay[day.date]?.fullDay ?? true) && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="time"
                          value={formStateByDay[day.date]?.startTime ?? ""}
                          onChange={(event) => handleTimeChange(day.date, "startTime", event.target.value)}
                          disabled={!data.canSubmit || saving}
                          className="border-subtle bg-surface text-default rounded-xl border px-3 py-2 text-sm"
                        />
                        <input
                          type="time"
                          value={formStateByDay[day.date]?.endTime ?? ""}
                          onChange={(event) => handleTimeChange(day.date, "endTime", event.target.value)}
                          disabled={!data.canSubmit || saving}
                          className="border-subtle bg-surface text-default rounded-xl border px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {QUICK_TIME_INTERVALS.map((interval, index) => {
                          const label = `${interval.startTime}–${interval.endTime}`;
                          return (
                            <button
                              key={`${day.date}-${label}-${index}`}
                              type="button"
                              disabled={!data.canSubmit || saving}
                              onClick={() => handleQuickIntervalApply(day.date, interval.startTime, interval.endTime)}
                              className="border-subtle bg-surface text-muted hover:bg-app rounded-full border px-2 py-1 text-[11px]"
                              aria-label={`Подставить интервал ${label}`}
                              title={`Подставить интервал ${label}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {formError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
        )}

        <label className="block space-y-2">
          <span className="text-muted text-sm font-medium">Комментарий</span>
          <textarea
            className="border-subtle bg-surface text-default focus:ring-default disabled:bg-app disabled:text-muted min-h-28 w-full rounded-2xl border px-4 py-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={!data.canSubmit || saving}
            placeholder="Например: могу выйти в любой день, кроме семейных обстоятельств"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSubmit} disabled={!data.canSubmit || saving} isLoading={saving}>
            {submitButtonLabel}
          </Button>
          <Button variant="outline" onClick={onBack} disabled={saving}>
            Назад к графикам
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SchedulePreferenceMeView;
