import React from "react";

import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import Button from "../../../shared/ui/Button";
import type { ChecklistRequest, ChecklistKind, ChecklistPeriodicity } from "../api";
import type { PositionDto } from "../../dictionaries/api";

type PositionField = { id: string; value: number | "" };

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export type ChecklistDialogInitial = {
  kind: ChecklistKind;
  name: string;
  content?: string;
  positionIds: number[];
  periodicity?: ChecklistPeriodicity;
  resetTime?: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  items?: string[];
};

type ChecklistDialogProps = {
  open: boolean;
  title: string;
  positions: PositionDto[];
  initialData?: ChecklistDialogInitial;
  isEditMode?: boolean;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: ChecklistRequest) => void;
};

const ChecklistDialog: React.FC<ChecklistDialogProps> = ({
  open,
  title,
  positions,
  initialData,
  isEditMode,
  submitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [kind, setKind] = React.useState<ChecklistKind>(initialData?.kind ?? "INFO");
  const [name, setName] = React.useState(initialData?.name ?? "");
  const [content, setContent] = React.useState(initialData?.content ?? "");
  const [periodicity, setPeriodicity] = React.useState<ChecklistPeriodicity | undefined>(initialData?.periodicity);
  const [resetHour, setResetHour] = React.useState<number | "">(initialData?.resetTime ? Number(initialData.resetTime.split(":")[0]) : "");
  const [resetMinute, setResetMinute] = React.useState<number | "">(initialData?.resetTime ? Number(initialData.resetTime.split(":")[1]) : "");
  const [resetDayOfWeek, setResetDayOfWeek] = React.useState<number | "">(initialData?.resetDayOfWeek ?? "");
  const [resetDayOfMonth, setResetDayOfMonth] = React.useState<number | "">(initialData?.resetDayOfMonth ?? "");
  const [positionFields, setPositionFields] = React.useState<PositionField[]>([]);
  const [items, setItems] = React.useState<{ id: string; value: string }[]>([]);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setKind(initialData?.kind ?? "INFO");
    setName(initialData?.name ?? "");
    setContent(initialData?.content ?? "");
    setPeriodicity(initialData?.periodicity ?? undefined);
    setResetHour(initialData?.resetTime ? Number(initialData.resetTime.split(":")[0]) : "");
    setResetMinute(initialData?.resetTime ? Number(initialData.resetTime.split(":")[1]) : "");
    setResetDayOfWeek(initialData?.resetDayOfWeek ?? "");
    setResetDayOfMonth(initialData?.resetDayOfMonth ?? "");
    if (initialData?.positionIds?.length) {
      setPositionFields(initialData.positionIds.map((id) => ({ id: createId(), value: id })));
    } else {
      setPositionFields([{ id: createId(), value: "" }]);
    }
    if (initialData?.items?.length) {
      setItems(initialData.items.map((value) => ({ id: createId(), value })));
    } else {
      setItems([{ id: createId(), value: "" }]);
    }
    setLocalError(null);
  }, [open, initialData]);

  React.useEffect(() => {
    if (!open) {
      setPositionFields([]);
      setItems([]);
    }
  }, [open]);

  const positionOptions = React.useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [positions]
  );

  const isTrackable = kind === "TRACKABLE";

  const handleAddPosition = React.useCallback(() => {
    setPositionFields((prev) => [...prev, { id: createId(), value: "" }]);
  }, []);

  const handleRemovePosition = React.useCallback((id: string) => {
    setPositionFields((prev) => (prev.length <= 1 ? prev : prev.filter((field) => field.id !== id)));
  }, []);

  const handlePositionChange = React.useCallback((id: string, value: string) => {
    setPositionFields((prev) => prev.map((field) => (field.id === id ? { ...field, value: value ? Number(value) : "" } : field)));
  }, []);

  const handleAddItem = React.useCallback(() => {
    setItems((prev) => [...prev, { id: createId(), value: "" }]);
  }, []);

  const handleRemoveItem = React.useCallback((id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }, []);

  const handleItemChange = React.useCallback((id: string, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, value } : item)));
  }, []);

  const buildResetTime = React.useCallback(() => {
    if (!periodicity || periodicity === "MANUAL") return undefined;
    if (resetHour === "" || resetMinute === "") return undefined;
    const hh = String(resetHour).padStart(2, "0");
    const mm = String(resetMinute).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [periodicity, resetHour, resetMinute]);

  const handleSubmit = React.useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError("Введите название чек-листа");
      return;
    }

    const selectedIds = positionFields
      .map((field) => field.value)
      .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    if (selectedIds.length === 0) {
      setLocalError("Добавьте хотя бы одну должность");
      return;
    }
    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.length !== selectedIds.length) {
      setLocalError("Каждую должность нужно выбрать только один раз");
      return;
    }

    if (!isTrackable) {
      if (!content.trim()) {
        setLocalError("Добавьте наполнение чек-листа");
        return;
      }
      setLocalError(null);
      onSubmit({
        name: trimmedName,
        content,
        kind,
        positionIds: uniqueIds,
      });
      return;
    }

    if (!periodicity) {
      setLocalError("Выберите периодичность");
      return;
    }

    const time = buildResetTime();
    if (periodicity !== "MANUAL" && !time) {
      setLocalError("Укажите время сброса");
      return;
    }

    if (periodicity === "WEEKLY" && (resetDayOfWeek === "" || resetDayOfWeek == null)) {
      setLocalError("Укажите день недели");
      return;
    }

    if (periodicity === "MONTHLY") {
      const day = typeof resetDayOfMonth === "number" ? resetDayOfMonth : Number(resetDayOfMonth);
      if (!day || Number.isNaN(day) || day < 1 || day > 31) {
        setLocalError("Укажите день месяца");
        return;
      }
    }

    const itemTexts = items.map((item) => item.value.trim()).filter((v) => v.length > 0);
    if (itemTexts.length === 0) {
      setLocalError("Добавьте хотя бы один пункт");
      return;
    }

    setLocalError(null);
    onSubmit({
      name: trimmedName,
      content,
      kind,
      periodicity,
      resetTime: time,
      resetDayOfWeek: typeof resetDayOfWeek === "number" ? resetDayOfWeek : undefined,
      resetDayOfMonth: typeof resetDayOfMonth === "number" ? resetDayOfMonth : Number(resetDayOfMonth) || undefined,
      items: itemTexts,
      positionIds: uniqueIds,
    });
  }, [
    name,
    positionFields,
    content,
    isTrackable,
    kind,
    periodicity,
    buildResetTime,
    resetDayOfWeek,
    resetDayOfMonth,
    items,
    onSubmit,
  ]);

  const effectiveError = error || localError;
  const isEditing = Boolean(isEditMode);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-2xl border px-3 py-2 text-sm transition ${
              kind === "TRACKABLE" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-zinc-300 bg-white"
            } ${isEditing ? "cursor-not-allowed opacity-70" : ""}`}
            onClick={() => !isEditing && setKind("TRACKABLE")}
            disabled={isEditing}
          >
            Чек-лист с отметками
          </button>
          <button
            type="button"
            className={`rounded-2xl border px-3 py-2 text-sm transition ${
              kind === "INFO" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-zinc-300 bg-white"
            } ${isEditing ? "cursor-not-allowed opacity-70" : ""}`}
            onClick={() => !isEditing && setKind("INFO")}
            disabled={isEditing}
          >
            Обычный чек-лист
          </button>
        </div>

        <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />

        <div>
          <div className="mb-2 text-sm text-zinc-600">Должности</div>
          <div className="space-y-3">
            {positionFields.map((field) => (
              <div key={field.id} className="flex items-center gap-3">
                <select
                  className="flex-1 rounded-2xl border border-zinc-300 p-2 text-sm"
                  value={field.value}
                  onChange={(event) => handlePositionChange(field.id, event.target.value)}
                  disabled={submitting}
                >
                  <option value="">Выберите должность</option>
                  {positionOptions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                      {!position.active ? " (неактивна)" : ""}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  onClick={() => handleRemovePosition(field.id)}
                  disabled={positionFields.length <= 1 || submitting}
                  className="text-sm text-zinc-600"
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={handleAddPosition} disabled={submitting} className="mt-2 text-sm">
            Добавить должность
          </Button>
        </div>

        {isTrackable ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-sm text-zinc-700">Периодичность</div>
              <select
                className="w-full rounded-2xl border border-zinc-300 p-2 text-sm"
                value={periodicity ?? ""}
                onChange={(event) => setPeriodicity((event.target.value || undefined) as ChecklistPeriodicity | undefined)}
                disabled={submitting}
              >
                <option value="">Выберите периодичность</option>
                <option value="DAILY">Каждый день</option>
                <option value="WEEKLY">Каждую неделю</option>
                <option value="MONTHLY">Каждый месяц</option>
                <option value="MANUAL">Только вручную</option>
              </select>
            </div>

            {periodicity && periodicity !== "MANUAL" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm text-zinc-700">Время сброса</div>
                  <div className="flex gap-2">
                    <select
                      className="w-full rounded-2xl border border-zinc-300 p-2 text-sm"
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
                    </select>
                    <select
                      className="w-full rounded-2xl border border-zinc-300 p-2 text-sm"
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
                    </select>
                  </div>
                </div>

                {periodicity === "WEEKLY" && (
                  <div>
                    <div className="mb-1 text-sm text-zinc-700">День недели</div>
                    <select
                      className="w-full rounded-2xl border border-zinc-300 p-2 text-sm"
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
                    </select>
                  </div>
                )}

                {periodicity === "MONTHLY" && (
                  <div>
                    <div className="mb-1 text-sm text-zinc-700">День месяца</div>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="w-full rounded-2xl border border-zinc-300 p-2 text-sm"
                      value={resetDayOfMonth}
                      onChange={(event) => setResetDayOfMonth(event.target.value ? Number(event.target.value) : "")}
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="mb-2 text-sm text-zinc-700">Пункты чек-листа</div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Textarea
                      label="Пункт чек-листа"
                      value={item.value}
                      onChange={(event) => handleItemChange(item.id, event.target.value)}
                      rows={2}
                      disabled={submitting}
                      className="flex-1 resize-y"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length <= 1 || submitting}
                      className="text-sm text-zinc-600"
                    >
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" onClick={handleAddItem} disabled={submitting} className="mt-2 text-sm">
                Добавить пункт
              </Button>
            </div>
          </div>
        ) : (
          <Textarea
            label="Чек-лист"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={10}
            disabled={submitting}
            className="resize-y"
          />
        )}

        {effectiveError && <div className="text-sm text-red-600">{effectiveError}</div>}
      </div>
    </Modal>
  );
};

export default ChecklistDialog;
