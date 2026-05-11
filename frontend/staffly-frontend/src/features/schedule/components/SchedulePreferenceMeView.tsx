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

const PREFERENCE_OPTIONS: { value: PreferenceSelectValue; label: string }[] = [
  { value: "", label: "Без пожелания" },
  { value: "AVAILABLE", label: "Могу" },
  { value: "UNAVAILABLE", label: "Не могу" },
  { value: "PREFER_DAY_OFF", label: "Хочу выходной" },
  { value: "PREFER_WORK", label: "Хочу работать" },
];

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

function getInitialSelections(data: SchedulePreferenceMyResponse): Record<string, PreferenceSelectValue> {
  const result: Record<string, PreferenceSelectValue> = {};
  data.cells.forEach((cell) => {
    if (cell.fullDay) {
      result[cell.day] = cell.type;
    }
  });
  return result;
}

function buildReadonlyMessage(data: SchedulePreferenceMyResponse): string {
  if (data.status !== "COLLECTING_PREFERENCES") {
    return "Сбор закрыт. Отправка пожеланий больше недоступна.";
  }
  return "Срок отправки пожеланий истёк.";
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
  const [selectedByDay, setSelectedByDay] = React.useState<Record<string, PreferenceSelectValue>>({});
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (!data) {
      setSelectedByDay({});
      setComment("");
      return;
    }

    setSelectedByDay(getInitialSelections(data));
    setComment(data.comment ?? "");
  }, [data]);

  const handleSelectionChange = React.useCallback((day: string, value: string) => {
    setSelectedByDay((prev) => ({
      ...prev,
      [day]: value as PreferenceSelectValue,
    }));
  }, []);

  const handleSubmit = React.useCallback(() => {
    if (!data || !data.canSubmit) return;

    const cells: SchedulePreferenceCellRequest[] = data.days.flatMap((day) => {
      const type = selectedByDay[day.date];
      if (!type) return [];
      return [
        {
          day: day.date,
          type,
          fullDay: true,
          startTime: null,
          endTime: null,
          note: null,
        },
      ];
    });

    onSubmit({
      cells,
      comment: comment.trim().length > 0 ? comment.trim() : null,
    });
  }, [comment, data, onSubmit, selectedByDay]);

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
        <div className="space-y-1">
          <h3 className="text-strong text-base font-semibold">Дни</h3>
          <p className="text-muted text-sm">Выберите одно пожелание на полный день или оставьте «Без пожелания».</p>
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
                value={selectedByDay[day.date] ?? ""}
                onChange={(event) => handleSelectionChange(day.date, event.target.value)}
                disabled={!data.canSubmit || saving}
              >
                {PREFERENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DropdownSelect>
            </div>
          ))}
        </div>

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
