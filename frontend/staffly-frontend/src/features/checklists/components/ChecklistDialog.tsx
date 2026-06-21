import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";
import Textarea from "../../../shared/ui/Textarea";
import type { ChecklistRequest, ChecklistKind, ChecklistPeriodicity } from "../api";
import type { PositionDto } from "../../dictionaries/api";

type PositionField = { id: string; value: number | "" };
type ChecklistItemField = {
  clientId: string;
  id?: number;
  value: string;
  completionPhotoRequired: boolean;
  examplePhotoUrl?: string | null;
  exampleFile?: File;
  examplePreviewUrl?: string;
  removeExamplePhoto?: boolean;
};

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
  items?: Array<{
    id?: number;
    text: string;
    completionPhotoRequired: boolean;
    examplePhotoUrl?: string | null;
  }>;
};

export type ChecklistDialogSubmitPayload = ChecklistRequest & {
  exampleFiles?: Array<{ index: number; file: File }>;
  examplePhotoDeletes?: number[];
};

type ChecklistDialogProps = {
  open: boolean;
  title: string;
  positions: PositionDto[];
  initialData?: ChecklistDialogInitial;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: ChecklistDialogSubmitPayload) => void;
};

const ChecklistDialog = ({
  open,
  title,
  positions,
  initialData,
  submitting,
  error,
  onClose,
  onSubmit,
}: ChecklistDialogProps) => {
  const [kind, setKind] = useState<ChecklistKind>(initialData?.kind ?? "INFO");
  const [name, setName] = useState(initialData?.name ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [periodicity, setPeriodicity] = useState<ChecklistPeriodicity | undefined>(initialData?.periodicity);
  const [resetHour, setResetHour] = useState<number | "">(
    initialData?.resetTime ? Number(initialData.resetTime.split(":")[0]) : "",
  );
  const [resetMinute, setResetMinute] = useState<number | "">(
    initialData?.resetTime ? Number(initialData.resetTime.split(":")[1]) : "",
  );
  const [resetDayOfWeek, setResetDayOfWeek] = useState<number | "">(initialData?.resetDayOfWeek ?? "");
  const [resetDayOfMonth, setResetDayOfMonth] = useState<number | "">(initialData?.resetDayOfMonth ?? "");
  const [positionFields, setPositionFields] = useState<PositionField[]>([]);
  const [items, setItems] = useState<ChecklistItemField[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
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
      setItems(
        initialData.items.map((item) => ({
          clientId: createId(),
          id: item.id,
          value: item.text,
          completionPhotoRequired: item.completionPhotoRequired,
          examplePhotoUrl: item.examplePhotoUrl,
        })),
      );
    } else {
      setItems([{ clientId: createId(), value: "", completionPhotoRequired: false }]);
    }
    setLocalError(null);
  }, [open, initialData]);

  useEffect(() => {
    if (!open) {
      setPositionFields([]);
      setItems((prev) => {
        prev.forEach((item) => {
          if (item.examplePreviewUrl) {
            URL.revokeObjectURL(item.examplePreviewUrl);
          }
        });
        return [];
      });
    }
  }, [open]);

  const positionOptions = useMemo(() => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ru")), [positions]);

  const isTrackable = kind === "TRACKABLE";

  const handleAddPosition = useCallback(() => {
    setPositionFields((prev) => [...prev, { id: createId(), value: "" }]);
  }, []);

  const handleRemovePosition = useCallback((id: string) => {
    setPositionFields((prev) => (prev.length <= 1 ? prev : prev.filter((field) => field.id !== id)));
  }, []);

  const handlePositionChange = useCallback((id: string, value: string) => {
    setPositionFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, value: value ? Number(value) : "" } : field)),
    );
  }, []);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, { clientId: createId(), value: "", completionPhotoRequired: false }]);
  }, []);

  const handleRemoveItem = useCallback((clientId: string) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const item = prev.find((entry) => entry.clientId === clientId);
      if (item?.examplePreviewUrl) {
        URL.revokeObjectURL(item.examplePreviewUrl);
      }
      return prev.filter((entry) => entry.clientId !== clientId);
    });
  }, []);

  const handleItemChange = useCallback((clientId: string, value: string) => {
    setItems((prev) => prev.map((item) => (item.clientId === clientId ? { ...item, value } : item)));
  }, []);

  const handleItemRequiredChange = useCallback((clientId: string, value: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, completionPhotoRequired: value } : item)),
    );
  }, []);

  const handleExampleFileChange = useCallback((clientId: string, file?: File) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.examplePreviewUrl) {
          URL.revokeObjectURL(item.examplePreviewUrl);
        }
        if (!file) {
          return { ...item, exampleFile: undefined, examplePreviewUrl: undefined };
        }
        return {
          ...item,
          exampleFile: file,
          examplePreviewUrl: URL.createObjectURL(file),
          removeExamplePhoto: false,
        };
      }),
    );
  }, []);

  const handleRemoveExamplePhoto = useCallback((clientId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.examplePreviewUrl) {
          URL.revokeObjectURL(item.examplePreviewUrl);
        }
        return {
          ...item,
          exampleFile: undefined,
          examplePreviewUrl: undefined,
          examplePhotoUrl: null,
          removeExamplePhoto: Boolean(item.id),
        };
      }),
    );
  }, []);

  const buildResetTime = useCallback(() => {
    if (!periodicity || periodicity === "MANUAL") return undefined;
    if (resetHour === "" || resetMinute === "") return undefined;
    const hh = String(resetHour).padStart(2, "0");
    const mm = String(resetMinute).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [periodicity, resetHour, resetMinute]);

  const handleSubmit = useCallback(() => {
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

    const normalizedItems = items
      .map((item) => ({ item, text: item.value.trim() }))
      .filter((entry) => entry.text.length > 0);
    if (normalizedItems.length === 0) {
      setLocalError("Добавьте хотя бы один пункт");
      return;
    }

    const itemDetails = normalizedItems.map((entry) => ({
      id: entry.item.id,
      text: entry.text,
      completionPhotoRequired: entry.item.completionPhotoRequired,
    }));
    const exampleFiles = normalizedItems
      .map((entry, index) => (entry.item.exampleFile ? { index, file: entry.item.exampleFile } : null))
      .filter((entry): entry is { index: number; file: File } => Boolean(entry));
    const examplePhotoDeletes = normalizedItems
      .map((entry) => (entry.item.removeExamplePhoto && entry.item.id ? entry.item.id : null))
      .filter((id): id is number => typeof id === "number");

    setLocalError(null);
    onSubmit({
      name: trimmedName,
      content,
      kind,
      periodicity,
      resetTime: time,
      resetDayOfWeek: typeof resetDayOfWeek === "number" ? resetDayOfWeek : undefined,
      resetDayOfMonth: typeof resetDayOfMonth === "number" ? resetDayOfMonth : Number(resetDayOfMonth) || undefined,
      itemDetails,
      items: itemDetails.map((item) => item.text),
      exampleFiles,
      examplePhotoDeletes,
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
        <Input label="Название" value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />

        <div>
          <div className="text-muted mb-2 text-sm">Должности</div>
          <div className="space-y-3">
            {positionFields.map((field) => (
              <div key={field.id} className="flex items-center gap-3">
                <DropdownSelect
                  aria-label="Должность"
                  className="flex-1 rounded-2xl p-2 text-base"
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
                </DropdownSelect>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemovePosition(field.id)}
                  disabled={positionFields.length <= 1 || submitting}
                  className="text-default"
                  aria-label="Удалить должность"
                >
                  <Icon icon={Trash2} />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddPosition} disabled={submitting} className="mt-2 text-sm">
            Добавить должность
          </Button>
        </div>

        {isTrackable ? (
          <div className="space-y-3">
            <div>
              <div className="text-default mb-1 text-sm">Периодичность</div>
              <DropdownSelect
                aria-label="Периодичность"
                className="w-full rounded-2xl p-2 text-base"
                value={periodicity ?? ""}
                onChange={(event) =>
                  setPeriodicity((event.target.value || undefined) as ChecklistPeriodicity | undefined)
                }
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

            <div>
              <div className="text-default mb-2 text-sm">Пункты чек-листа</div>
              <div className="space-y-3">
                {items.map((item, index) => {
                  const examplePreview = item.examplePreviewUrl || item.examplePhotoUrl || undefined;
                  return (
                    <div key={item.clientId} className="border-subtle bg-app/60 space-y-3 rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted text-sm">Пункт {index + 1}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveItem(item.clientId)}
                          disabled={items.length <= 1 || submitting}
                          className="text-default"
                          aria-label="Удалить пункт чек-листа"
                        >
                          <Icon icon={Trash2} />
                        </Button>
                      </div>
                      <textarea
                        value={item.value}
                        onChange={(event) => handleItemChange(item.clientId, event.target.value)}
                        rows={2}
                        disabled={submitting}
                        className="border-subtle bg-surface text-default focus:ring-default w-full resize-y rounded-xl border p-3 text-[16px] [overflow-wrap:anywhere] transition outline-none focus:ring-2"
                      />
                      <label className="bg-surface text-default inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.completionPhotoRequired}
                          onChange={(event) => handleItemRequiredChange(item.clientId, event.target.checked)}
                          disabled={submitting}
                          className="h-4 w-4 accent-[var(--staffly-text-strong)]"
                        />
                        <span>Требовать фото перед закрытием</span>
                      </label>
                      <div className="border-subtle bg-surface grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {examplePreview ? (
                            <img
                              src={examplePreview}
                              alt={`Эталон пункта ${index + 1}`}
                              className="h-20 w-28 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="border-subtle bg-app text-muted flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed">
                              <Icon icon={ImagePlus} decorative />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-default text-sm font-medium">Эталон для сотрудника</div>
                            <div className="text-muted text-xs">
                              {item.exampleFile
                                ? item.exampleFile.name
                                : examplePreview
                                  ? "Фото прикреплено"
                                  : "Можно оставить без эталона"}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className="border-subtle text-default inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-2xl border bg-[var(--staffly-control)] px-3 text-sm font-medium shadow-sm transition hover:bg-[var(--staffly-control-hover)]">
                            <Icon icon={ImagePlus} size="sm" decorative />
                            <span>{examplePreview ? "Заменить эталон" : "Добавить эталон"}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={submitting}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  handleExampleFileChange(item.clientId, file);
                                }
                                event.target.value = "";
                              }}
                            />
                          </label>
                          {examplePreview && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleRemoveExamplePhoto(item.clientId)}
                              disabled={submitting}
                              className="h-9 text-sm"
                              aria-label="Удалить пример"
                            >
                              Удалить
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" onClick={handleAddItem} disabled={submitting} className="mt-2 text-sm">
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
