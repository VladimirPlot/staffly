import React from "react";
import { Info } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Modal from "../../../shared/ui/Modal";
import { formatDateFromIso } from "../../../shared/utils/date";
import type {
  SchedulePreferenceAllowedShiftOptionDto,
  SchedulePreferenceMyResponse,
  SchedulePreferenceType,
  UpsertMySchedulePreferenceRequest,
} from "../api";
import {
  buildPreferenceCellsRequest,
  canAutosaveSchedulePreferenceDraft,
  readSchedulePreferenceDraft,
  removeSchedulePreferenceDraft,
  resolveSchedulePreferenceDraft,
  writeSchedulePreferenceDraft,
  type PreferenceDayDraft,
  type SchedulePreferenceDraftIdentity,
} from "../schedulePreferenceDraftStorage";
import { getScheduleStatusLabel } from "../utils/status";
import { formatInstantInTimeZone } from "../utils/date";
import {
  addDayDuringDrag,
  applyPreferenceDayEdit,
  applyPreferenceToSelectedDays,
  getCalendarLeadingSlotCount,
  getDaysForWeekday,
  getPreferenceCalendarPresentation,
  hasPreferenceDayNote,
  normalizePreferenceEdit,
  toggleSelectedDay,
  toggleWeekdaySelection,
} from "../schedulePreferenceCalendar";

type SchedulePreferenceMeViewProps = {
  restaurantId: number;
  data: SchedulePreferenceMyResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  message: string | null;
  onBack: () => void;
  onSubmit: (
    request: UpsertMySchedulePreferenceRequest,
    onSuccessBeforePublish: () => void,
  ) => Promise<SchedulePreferenceMyResponse | null>;
  timeZone: string;
};

type PreferenceSelectValue = "NO_PREFERENCE" | SchedulePreferenceType;
type PreferenceFormState = Record<string, PreferenceDayDraft>;

const PREFERENCE_OPTIONS: { value: PreferenceSelectValue; label: string }[] = [
  { value: "NO_PREFERENCE", label: "Без пожеланий" },
  { value: "UNAVAILABLE", label: "Не могу работать" },
  { value: "PREFER_DAY_OFF", label: "Предпочитаю выходной" },
  { value: "AVAILABLE", label: "Могу работать" },
];

const EMPTY_DAY: PreferenceDayDraft = { type: "NO_PREFERENCE", fullDay: true, startTime: "", endTime: "", note: "" };
const WEEKDAYS = [
  { short: "Пн", name: "понедельники" },
  { short: "Вт", name: "вторники" },
  { short: "Ср", name: "среды" },
  { short: "Чт", name: "четверги" },
  { short: "Пт", name: "пятницы" },
  { short: "Сб", name: "субботы" },
  { short: "Вс", name: "воскресенья" },
];
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

function normalizeTimeForUi(value: string | null | undefined): string {
  if (!value) return "";

  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return value;

  return `${match[1]}:${match[2]}`;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return hours * 60 + minutes;
}

function isMidnight(value: string): boolean {
  return parseTimeToMinutes(value) === 0;
}

function getEndTimeMinutesForPreference(value: string): number | null {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return null;

  return isMidnight(value) ? 24 * 60 : minutes;
}

function isValidPreferenceTimeInterval(startTime: string, endTime: string): boolean {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = getEndTimeMinutesForPreference(endTime);

  if (startMinutes === null || endMinutes === null) return false;

  return startMinutes < endMinutes;
}

function buildReadonlyMessage(data: SchedulePreferenceMyResponse): string {
  if (data.status !== "COLLECTING_PREFERENCES") {
    return "Сбор закрыт. Отправка пожеланий больше недоступна.";
  }
  return "Срок отправки пожеланий истёк.";
}

function getDayOffsetFromStart(day: string, startDay: string): number {
  const dayDate = new Date(`${day}T00:00:00Z`);
  const startDate = new Date(`${startDay}T00:00:00Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((dayDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function getPositiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function buildRepeatingPattern(
  days: SchedulePreferenceMyResponse["days"],
  workCount: number,
  offCount: number,
  startDay: string,
): PreferenceFormState {
  const result: PreferenceFormState = {};
  const cycleLength = workCount + offCount;

  days.forEach((day) => {
    const indexInCycle = getPositiveModulo(getDayOffsetFromStart(day.date, startDay), cycleLength);
    result[day.date] = {
      type: indexInCycle < workCount ? "AVAILABLE" : "UNAVAILABLE",
      fullDay: true,
      startTime: "",
      endTime: "",
      note: "",
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
    result[day.date] = { type, fullDay: true, startTime: "", endTime: "", note: "" };
  });
  return result;
}

const SchedulePreferenceMeView: React.FC<SchedulePreferenceMeViewProps> = ({
  restaurantId,
  data,
  loading,
  saving,
  error,
  message,
  onBack,
  onSubmit,
  timeZone,
}) => {
  const [formStateByDay, setFormStateByDay] = React.useState<PreferenceFormState>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [periodComment, setPeriodComment] = React.useState("");
  const [quickPatternStartDay, setQuickPatternStartDay] = React.useState("");
  const [baseRevision, setBaseRevision] = React.useState<number | null>(null);
  const [draftNotice, setDraftNotice] = React.useState<string | null>(null);
  const [editorDay, setEditorDay] = React.useState<string | null>(null);
  const [editorValue, setEditorValue] = React.useState<PreferenceDayDraft | null>(null);
  const [selectedDays, setSelectedDays] = React.useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [bulkEditorOpen, setBulkEditorOpen] = React.useState(false);
  const [bulkEditorValue, setBulkEditorValue] = React.useState<PreferenceDayDraft | null>(null);
  const hydratedRef = React.useRef(false);
  const shouldAutosaveRef = React.useRef(false);
  const draftIdentityRef = React.useRef<SchedulePreferenceDraftIdentity | null>(null);
  const selectionModeRef = React.useRef(false);
  const longPressTimerRef = React.useRef<number | null>(null);
  const pointerRef = React.useRef<{
    id: number;
    startX: number;
    startY: number;
    originDay: string;
    activeDrag: boolean;
    movedDuringDrag: boolean;
    visited: Set<string>;
    captureTarget: HTMLButtonElement;
  } | null>(null);
  const suppressClickRef = React.useRef(false);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const clearSelection = React.useCallback(() => {
    clearLongPressTimer();
    pointerRef.current = null;
    selectionModeRef.current = false;
    setSelectionMode(false);
    setSelectedDays(new Set());
    setBulkEditorOpen(false);
    setBulkEditorValue(null);
  }, [clearLongPressTimer]);

  React.useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  React.useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  React.useEffect(() => {
    if (!data) {
      hydratedRef.current = false;
      shouldAutosaveRef.current = false;
      draftIdentityRef.current = null;
      setFormStateByDay({});
      setFormError(null);
      setPeriodComment("");
      setQuickPatternStartDay("");
      setBaseRevision(null);
      setDraftNotice(null);
      return;
    }
    const identity = {
      restaurantId,
      memberId: data.member.memberId,
      scheduleId: data.scheduleId,
      preferenceCollectionCycle: data.preferenceCollectionCycle,
    };
    const storedDraft = readSchedulePreferenceDraft(identity);
    const resolved = resolveSchedulePreferenceDraft(data, storedDraft);
    if (resolved.reason === "REVISION_MISMATCH" || resolved.reason === "COLLECTION_CLOSED") {
      removeSchedulePreferenceDraft(identity);
    }
    draftIdentityRef.current = identity;
    shouldAutosaveRef.current = resolved.reason === "RESTORED";
    setFormStateByDay(resolved.editableState.cellsByDay);
    setBaseRevision(resolved.baseRevision);
    setFormError(null);
    setEditorDay(null);
    setEditorValue(null);
    clearSelection();
    setPeriodComment(resolved.editableState.periodComment);
    setQuickPatternStartDay(data.days[0]?.date ?? "");
    setDraftNotice(
      resolved.reason === "REVISION_MISMATCH"
        ? "Ваши сохранённые пожелания изменились в другой сессии. Локальный черновик не был восстановлен."
        : null,
    );
    hydratedRef.current = true;
  }, [clearSelection, data, restaurantId]);

  React.useEffect(() => {
    const identity = draftIdentityRef.current;
    if (!canAutosaveSchedulePreferenceDraft(hydratedRef.current, shouldAutosaveRef.current, identity, baseRevision)) {
      return;
    }
    if (baseRevision === null) return;
    writeSchedulePreferenceDraft(identity, {
      schemaVersion: 1,
      baseRevision,
      savedAt: new Date().toISOString(),
      cellsByDay: formStateByDay,
      periodComment,
    });
  }, [baseRevision, formStateByDay, periodComment]);

  const markEdited = React.useCallback(() => {
    shouldAutosaveRef.current = true;
  }, []);

  const openDayEditor = React.useCallback(
    (day: string) => {
      setEditorDay(day);
      setEditorValue({ ...(formStateByDay[day] ?? EMPTY_DAY) });
    },
    [formStateByDay],
  );

  const closeDayEditor = React.useCallback(() => {
    setEditorDay(null);
    setEditorValue(null);
  }, []);

  React.useEffect(() => {
    if (data?.canSubmit) return;
    clearSelection();
    closeDayEditor();
  }, [clearSelection, closeDayEditor, data?.canSubmit]);

  const applyDayEditor = React.useCallback(() => {
    if (!data?.canSubmit || saving || !editorDay || !editorValue) return;
    const normalized = normalizePreferenceEdit(editorValue);
    markEdited();
    setFormError(null);
    setFormStateByDay((previous) => applyPreferenceDayEdit(previous, editorDay, normalized));
    closeDayEditor();
  }, [closeDayEditor, data?.canSubmit, editorDay, editorValue, markEdited, saving]);

  const toggleSelection = React.useCallback((day: string) => {
    setSelectedDays((previous) => {
      const next = toggleSelectedDay(previous, day);
      if (next.size === 0) {
        selectionModeRef.current = false;
        setSelectionMode(false);
      }
      return next;
    });
  }, []);

  const handleWeekdayClick = React.useCallback(
    (weekdayIndex: number) => {
      if (!data?.canSubmit || saving) return;
      setSelectedDays((previous) => {
        const next = toggleWeekdaySelection(
          previous,
          data.days.map((day) => day.date),
          weekdayIndex,
        );
        const hasSelection = next.size > 0;
        selectionModeRef.current = hasSelection;
        setSelectionMode(hasSelection);
        return next;
      });
    },
    [data, saving],
  );

  const handleCalendarPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, day: string) => {
      if (!data?.canSubmit || saving || event.button !== 0) return;
      clearLongPressTimer();
      pointerRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originDay: day,
        activeDrag: selectionModeRef.current,
        movedDuringDrag: false,
        visited: new Set([day]),
        captureTarget: event.currentTarget,
      };
      if (selectionModeRef.current) return;
      longPressTimerRef.current = window.setTimeout(() => {
        const pointer = pointerRef.current;
        if (!pointer || pointer.id !== event.pointerId || !data.canSubmit) return;
        pointer.activeDrag = true;
        pointer.captureTarget.setPointerCapture(pointer.id);
        selectionModeRef.current = true;
        suppressClickRef.current = true;
        setSelectionMode(true);
        setSelectedDays((previous) => {
          const next = new Set(previous);
          next.add(day);
          return next;
        });
      }, LONG_PRESS_MS);
    },
    [clearLongPressTimer, data?.canSubmit, saving],
  );

  const handleCalendarPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!pointer.activeDrag) {
        if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > LONG_PRESS_MOVE_TOLERANCE_PX) {
          clearLongPressTimer();
          pointerRef.current = null;
        }
        return;
      }
      event.preventDefault();
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-preference-day]");
      const day = target?.dataset.preferenceDay;
      if (!day || pointer.visited.has(day)) return;
      pointer.movedDuringDrag = true;
      suppressClickRef.current = true;
      setSelectedDays((previous) => addDayDuringDrag(previous, pointer.visited, day));
    },
    [clearLongPressTimer],
  );

  const finishCalendarPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (pointerRef.current?.id !== event.pointerId) return;
      clearLongPressTimer();
      pointerRef.current = null;
    },
    [clearLongPressTimer],
  );

  const handleDayClick = React.useCallback(
    (day: string) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (selectionModeRef.current) toggleSelection(day);
      else openDayEditor(day);
    },
    [openDayEditor, toggleSelection],
  );

  const applyBulkEditor = React.useCallback(() => {
    if (!data?.canSubmit || saving || !bulkEditorValue || selectedDays.size === 0) return;
    markEdited();
    setFormError(null);
    setFormStateByDay((previous) => applyPreferenceToSelectedDays(previous, selectedDays, bulkEditorValue));
    clearSelection();
  }, [bulkEditorValue, clearSelection, data?.canSubmit, markEdited, saving, selectedDays]);

  const handleQuickPatternStartDayChange = React.useCallback((value: string) => {
    setQuickPatternStartDay(value);
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!data || !data.canSubmit || baseRevision === null) return;

    for (const day of data.days) {
      const value = formStateByDay[day.date];
      const type = value?.type ?? "NO_PREFERENCE";
      if (type === "NO_PREFERENCE") continue;

      if (!value.fullDay) {
        if (!value.startTime || !value.endTime) {
          setFormError(`Заполните время для ${formatDateFromIso(day.date)}.`);
          return;
        }
        if (parseTimeToMinutes(value.startTime) === parseTimeToMinutes(value.endTime)) {
          setFormError(`Время начала и окончания не должно совпадать (${formatDateFromIso(day.date)}).`);
          return;
        }
        if (!isValidPreferenceTimeInterval(value.startTime, value.endTime)) {
          setFormError(`Время начала должно быть раньше окончания (${formatDateFromIso(day.date)}).`);
          return;
        }
      }
    }
    const identity = draftIdentityRef.current;
    await onSubmit(
      {
        expectedRevision: baseRevision,
        cells: buildPreferenceCellsRequest(data.days, formStateByDay),
        periodComment: periodComment.trim().length > 0 ? periodComment.trim() : null,
      },
      () => {
        shouldAutosaveRef.current = false;
        if (identity) removeSchedulePreferenceDraft(identity);
      },
    );
  }, [baseRevision, data, formStateByDay, onSubmit, periodComment]);

  const clearAll = React.useCallback(() => {
    markEdited();
    setFormStateByDay((previous) =>
      Object.fromEntries(
        Object.keys(previous).map((day) => [
          day,
          {
            type: "NO_PREFERENCE",
            fullDay: true,
            startTime: "",
            endTime: "",
            note: "",
          },
        ]),
      ),
    );
    setFormError(null);
  }, [markEdited]);

  const replaceAllDays = React.useCallback(
    (next: PreferenceFormState) => {
      markEdited();
      setFormStateByDay(next);
    },
    [markEdited],
  );

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
  const selectedQuickPatternStartDay = data.days.some((day) => day.date === quickPatternStartDay)
    ? quickPatternStartDay
    : (data.days[0]?.date ?? "");
  const allowedShiftOptions = editorDay ? (data.allowedShiftOptionsByDate?.[editorDay] ?? []) : [];
  const hasAllowedShiftOptions = allowedShiftOptions.length > 0;
  const bulkAllowedShiftOptions = Array.from(selectedDays).reduce<SchedulePreferenceAllowedShiftOptionDto[]>(
    (common, day, index) => {
      const options = data.allowedShiftOptionsByDate?.[day] ?? [];
      return index === 0
        ? options
        : common.filter((candidate) =>
            options.some((option) => option.startTime === candidate.startTime && option.endTime === candidate.endTime),
          );
    },
    [],
  );
  const hasBulkAllowedShiftOptions = bulkAllowedShiftOptions.length > 0;

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
            <div className="text-muted text-sm">
              Дедлайн: {formatInstantInTimeZone(data.preferenceDeadline, timeZone)}
            </div>
          </div>
          <Button variant="outline" onClick={onBack}>
            Назад к графикам
          </Button>
        </div>

        {data.submittedAt && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Пожелания отправлены: {formatInstantInTimeZone(data.submittedAt, timeZone)} · ревизия {data.revision}
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
        {draftNotice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {draftNotice}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-[var(--staffly-border)] p-4">
          <h3 className="text-strong text-base font-semibold">Быстро заполнить</h3>
          <p className="text-muted text-sm">
            Выберите шаблон, а потом при необходимости поправьте отдельные дни вручную.
          </p>
          <div className="grid gap-2 sm:max-w-xs">
            <DropdownSelect
              label="Старт схемы"
              aria-label="Старт схемы"
              value={selectedQuickPatternStartDay}
              onChange={(event) => handleQuickPatternStartDayChange(event.target.value)}
              disabled={!data.canSubmit || saving}
            >
              {data.days.map((day) => (
                <option key={day.date} value={day.date}>
                  {day.date} · {day.weekdayLabel}
                </option>
              ))}
            </DropdownSelect>
            <p className="text-muted text-xs">Выберите день, с которого начинается рабочая часть схемы.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => replaceAllDays(buildRepeatingPattern(data.days, 2, 2, selectedQuickPatternStartDay))}
            >
              2/2
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => replaceAllDays(buildRepeatingPattern(data.days, 3, 3, selectedQuickPatternStartDay))}
            >
              3/3
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => replaceAllDays(buildRepeatingPattern(data.days, 5, 2, selectedQuickPatternStartDay))}
            >
              5/2
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => replaceAllDays(fillAll(data.days, "AVAILABLE"))}
            >
              Все дни могу работать
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data.canSubmit || saving}
              onClick={() => replaceAllDays(fillAll(data.days, "UNAVAILABLE"))}
            >
              Все дни не могу работать
            </Button>
            <Button type="button" variant="outline" disabled={!data.canSubmit || saving} onClick={clearAll}>
              Очистить все
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-strong text-base font-semibold">Дни</h3>
          <p className="text-muted text-sm">
            {data.preferenceCollectionMode === "SHIFT_OPTIONS"
              ? "Выберите пожелание на день. Для «Могу работать» можно указать вариант смены."
              : "Выберите пожелание на день без указания времени."}
          </p>
        </div>

        {selectionMode && data.canSubmit && (
          <div className="border-subtle bg-app flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
            <span className="text-default text-sm font-semibold">Выбрано: {selectedDays.size} дн.</span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={selectedDays.size === 0 || saving}
                onClick={() => {
                  setBulkEditorValue(null);
                  setBulkEditorOpen(true);
                }}
                aria-haspopup="dialog"
                data-open-bulk-editor
              >
                Изменить
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearSelection}>
                Отменить выбор
              </Button>
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl" aria-label="Календарь пожеланий">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday, weekdayIndex) => {
              const weekdayDays = getDaysForWeekday(
                data.days.map((day) => day.date),
                weekdayIndex,
              );
              const allSelected = weekdayDays.length > 0 && weekdayDays.every((day) => selectedDays.has(day));
              return (
                <button
                  key={weekday.short}
                  type="button"
                  disabled={!data.canSubmit || saving || weekdayDays.length === 0}
                  onClick={() => handleWeekdayClick(weekdayIndex)}
                  aria-label={`Выбрать все ${weekday.name} в периоде`}
                  aria-pressed={allSelected}
                  className={`py-1 text-center text-[11px] font-semibold transition disabled:cursor-default ${
                    allSelected
                      ? "text-blue-700 underline decoration-2 underline-offset-2"
                      : "text-muted enabled:hover:text-[var(--staffly-text)]"
                  }`}
                >
                  {weekday.short}
                </button>
              );
            })}
          </div>
          <div
            className="grid grid-cols-7 gap-1"
            onPointerMove={handleCalendarPointerMove}
            onPointerUp={finishCalendarPointer}
            onPointerCancel={finishCalendarPointer}
          >
            {Array.from({ length: getCalendarLeadingSlotCount(data.days[0]?.date ?? data.startDate) }).map(
              (_, index) => (
                <div key={`leading-${index}`} aria-hidden="true" />
              ),
            )}
            {data.days.map((day) => {
              const presentation = getPreferenceCalendarPresentation(formStateByDay[day.date]);
              const toneClass =
                presentation.tone === "red"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : presentation.tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800";
              const isSelected = selectedDays.has(day.date);
              const hasNote = hasPreferenceDayNote(formStateByDay[day.date]);
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!data.canSubmit || saving}
                  data-preference-day={day.date}
                  onPointerDown={(event) => handleCalendarPointerDown(event, day.date)}
                  onClick={() => handleDayClick(day.date)}
                  aria-label={`${formatDateFromIso(day.date)}: ${presentation.label}`}
                  aria-pressed={selectionMode ? isSelected : undefined}
                  className={`${toneClass} ${isSelected ? "ring-2 ring-blue-600 ring-offset-1" : ""} relative min-w-0 touch-pan-y rounded-lg border px-0.5 py-1.5 text-center transition select-none enabled:hover:brightness-95 enabled:focus-visible:ring-2 enabled:focus-visible:ring-[var(--staffly-ring)] disabled:cursor-default sm:rounded-xl sm:px-1 sm:py-2`}
                >
                  {hasNote && (
                    <Info aria-hidden="true" className="pointer-events-none absolute top-1 right-1 size-3 opacity-70" />
                  )}
                  <span className="block text-sm font-bold">{Number(day.date.slice(-2))}</span>
                  <span className="block truncate text-[9px] leading-3 sm:text-[11px]">{presentation.label}</span>
                  {presentation.startTime && presentation.endTime && (
                    <span className="mt-0.5 block text-[10px] leading-3 font-semibold tabular-nums">
                      {presentation.startTime}
                      <br />
                      {presentation.endTime}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Modal
          open={editorDay !== null && editorValue !== null}
          title={editorDay ? formatDateFromIso(editorDay) : "Пожелание на день"}
          description={data.days.find((day) => day.date === editorDay)?.weekdayLabel}
          onClose={closeDayEditor}
          headerCloseButton
          className="max-w-lg"
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeDayEditor}>
                Отменить
              </Button>
              <Button type="button" onClick={applyDayEditor}>
                Применить
              </Button>
            </>
          }
        >
          {editorValue && (
            <div className="space-y-4 p-2 sm:p-0">
              <DropdownSelect
                label="Текущее пожелание"
                value={editorValue.type}
                onChange={(event) => {
                  const type = event.target.value as PreferenceSelectValue;
                  setEditorValue(
                    (previous) => previous && { ...previous, type, fullDay: true, startTime: "", endTime: "" },
                  );
                }}
              >
                {PREFERENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DropdownSelect>
              {editorValue.type === "AVAILABLE" && (
                <DropdownSelect
                  label="Когда можете работать"
                  value={editorValue.fullDay ? "FULL_DAY" : `${editorValue.startTime}|${editorValue.endTime}`}
                  onChange={(event) => {
                    if (event.target.value === "FULL_DAY") {
                      setEditorValue(
                        (previous) => previous && { ...previous, fullDay: true, startTime: "", endTime: "" },
                      );
                      return;
                    }
                    const [startTime, endTime] = event.target.value.split("|");
                    setEditorValue((previous) => previous && { ...previous, fullDay: false, startTime, endTime });
                  }}
                >
                  <option value="FULL_DAY">Могу работать в любое время</option>
                  {data.preferenceCollectionMode === "SHIFT_OPTIONS" &&
                    allowedShiftOptions.map((option) => {
                      const startTime = normalizeTimeForUi(option.startTime);
                      const endTime = normalizeTimeForUi(option.endTime);
                      return (
                        <option key={option.id} value={`${startTime}|${endTime}`}>
                          {option.label ? `${option.label} · ` : ""}
                          {startTime}–{endTime}
                        </option>
                      );
                    })}
                </DropdownSelect>
              )}
              {editorValue.type === "AVAILABLE" &&
                data.preferenceCollectionMode === "SHIFT_OPTIONS" &&
                !hasAllowedShiftOptions && (
                  <p className="text-muted text-sm">
                    Для вашей должности не настроены варианты смен. Доступен вариант на весь день.
                  </p>
                )}
              <label className="block space-y-1">
                <span className="text-muted text-sm font-medium">Комментарий к дню</span>
                <textarea
                  className="border-subtle bg-surface text-default focus:ring-default disabled:bg-app disabled:text-muted min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  value={editorValue.type === "NO_PREFERENCE" ? "" : editorValue.note}
                  onChange={(event) =>
                    setEditorValue((previous) => previous && { ...previous, note: event.target.value })
                  }
                  disabled={editorValue.type === "NO_PREFERENCE"}
                  maxLength={500}
                  placeholder={
                    editorValue.type === "NO_PREFERENCE"
                      ? "Комментарий доступен для явного пожелания"
                      : "Комментарий к этому дню"
                  }
                />
                {editorValue.type === "NO_PREFERENCE" && (
                  <span className="text-muted block text-xs">
                    Без пожелания не создаёт запись дня, поэтому комментарий не сохраняется.
                  </span>
                )}
              </label>
            </div>
          )}
        </Modal>

        <Modal
          open={selectionMode && bulkEditorOpen}
          title={`${selectedDays.size} дней выбрано`}
          description="Новое пожелание будет применено ко всем выбранным дням."
          onClose={() => {
            setBulkEditorOpen(false);
            setBulkEditorValue(null);
          }}
          headerCloseButton
          className="max-w-lg"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBulkEditorOpen(false);
                  setBulkEditorValue(null);
                }}
              >
                Отменить
              </Button>
              <Button type="button" onClick={applyBulkEditor} disabled={!bulkEditorValue || !data.canSubmit || saving}>
                Применить
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-2 sm:p-0">
            <fieldset className="space-y-2">
              <legend className="text-muted mb-1 text-sm font-medium">Новое пожелание</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PREFERENCE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={bulkEditorValue?.type === option.value ? "primary" : "outline"}
                    onClick={() =>
                      setBulkEditorValue({
                        type: option.value,
                        fullDay: true,
                        startTime: "",
                        endTime: "",
                        note: bulkEditorValue?.note ?? "",
                      })
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </fieldset>
            {bulkEditorValue?.type === "AVAILABLE" && (
              <DropdownSelect
                label="Когда можете работать"
                value={bulkEditorValue.fullDay ? "FULL_DAY" : `${bulkEditorValue.startTime}|${bulkEditorValue.endTime}`}
                onChange={(event) => {
                  if (event.target.value === "FULL_DAY") {
                    setBulkEditorValue(
                      (previous) => previous && { ...previous, fullDay: true, startTime: "", endTime: "" },
                    );
                    return;
                  }
                  const [startTime, endTime] = event.target.value.split("|");
                  setBulkEditorValue((previous) => previous && { ...previous, fullDay: false, startTime, endTime });
                }}
              >
                <option value="FULL_DAY">Могу работать в любое время</option>
                {data.preferenceCollectionMode === "SHIFT_OPTIONS" &&
                  bulkAllowedShiftOptions.map((option) => {
                    const startTime = normalizeTimeForUi(option.startTime);
                    const endTime = normalizeTimeForUi(option.endTime);
                    return (
                      <option key={option.id} value={`${startTime}|${endTime}`}>
                        {option.label ? `${option.label} · ` : ""}
                        {startTime}–{endTime}
                      </option>
                    );
                  })}
              </DropdownSelect>
            )}
            {bulkEditorValue?.type === "AVAILABLE" &&
              data.preferenceCollectionMode === "SHIFT_OPTIONS" &&
              !hasBulkAllowedShiftOptions && (
                <p className="text-muted text-sm">
                  Для вашей должности не настроены варианты смен. Доступен вариант на весь день.
                </p>
              )}
            <label className="block space-y-1">
              <span className="text-muted text-sm font-medium">Комментарий для выбранных дней</span>
              <textarea
                className="border-subtle bg-surface text-default focus:ring-default disabled:bg-app disabled:text-muted min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                value={bulkEditorValue?.type === "NO_PREFERENCE" ? "" : (bulkEditorValue?.note ?? "")}
                onChange={(event) =>
                  setBulkEditorValue((previous) => previous && { ...previous, note: event.target.value })
                }
                disabled={!bulkEditorValue || bulkEditorValue.type === "NO_PREFERENCE"}
                maxLength={500}
                placeholder={
                  bulkEditorValue?.type === "NO_PREFERENCE"
                    ? "Комментарий доступен для явного пожелания"
                    : "Один комментарий для каждого выбранного дня"
                }
              />
              {bulkEditorValue?.type === "NO_PREFERENCE" && (
                <span className="text-muted block text-xs">
                  Без пожелания не создаёт запись дня, поэтому комментарий не сохраняется.
                </span>
              )}
            </label>
          </div>
        </Modal>

        {formError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
        )}

        <label className="block space-y-2">
          <span className="text-muted text-sm font-medium">Комментарий к периоду</span>
          <textarea
            className="border-subtle bg-surface text-default focus:ring-default disabled:bg-app disabled:text-muted min-h-28 w-full rounded-2xl border px-4 py-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed"
            value={periodComment}
            onChange={(event) => {
              markEdited();
              setPeriodComment(event.target.value);
            }}
            disabled={!data.canSubmit || saving}
            maxLength={1000}
            placeholder="Например: могу работать только после 17:00 из-за учёбы"
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
