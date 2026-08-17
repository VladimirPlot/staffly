import { useCallback, useEffect, useMemo, useState } from "react";

import type { ChecklistPeriodicity, ChecklistPhotoMode } from "../../api";
import type { PositionDto } from "../../../dictionaries/api";
import type { ChecklistDialogInitial, ChecklistDialogSubmitPayload, ChecklistItemField, PositionField } from "./types";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function parseResetTimePart(resetTime: string | undefined, part: 0 | 1): number | "" {
  return resetTime ? Number(resetTime.split(":")[part]) : "";
}

function resolvePhotoMode(item: { completionPhotoMode?: ChecklistPhotoMode | null; completionPhotoRequired: boolean }) {
  return item.completionPhotoMode ?? (item.completionPhotoRequired ? "REQUIRED" : "NONE");
}

function clearExamplePhoto(item: ChecklistItemField): ChecklistItemField {
  return {
    ...item,
    exampleFile: undefined,
    examplePreviewUrl: undefined,
    examplePhotoUrl: null,
    removeExamplePhoto: Boolean(item.id && item.examplePhotoUrl) || item.removeExamplePhoto,
  };
}

type UseChecklistDialogFormParams = {
  open: boolean;
  positions: PositionDto[];
  initialData?: ChecklistDialogInitial;
  onSubmit: (payload: ChecklistDialogSubmitPayload) => void;
};

export function useChecklistDialogForm({ open, positions, initialData, onSubmit }: UseChecklistDialogFormParams) {
  const [kind, setKind] = useState(initialData?.kind ?? "INFO");
  const [name, setName] = useState(initialData?.name ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [periodicity, setPeriodicity] = useState<ChecklistPeriodicity | undefined>(initialData?.periodicity);
  const [resetHour, setResetHour] = useState<number | "">(parseResetTimePart(initialData?.resetTime, 0));
  const [resetMinute, setResetMinute] = useState<number | "">(parseResetTimePart(initialData?.resetTime, 1));
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
    setResetHour(parseResetTimePart(initialData?.resetTime, 0));
    setResetMinute(parseResetTimePart(initialData?.resetTime, 1));
    setResetDayOfWeek(initialData?.resetDayOfWeek ?? "");
    setResetDayOfMonth(initialData?.resetDayOfMonth ?? "");
    setPositionFields(
      initialData?.positionIds?.length
        ? initialData.positionIds.map((id) => ({ id: createId(), value: id }))
        : [{ id: createId(), value: "" }],
    );
    setItems(
      initialData?.items?.length
        ? initialData.items.map((item) => ({
            clientId: createId(),
            id: item.id,
            value: item.text,
            completionPhotoMode: resolvePhotoMode(item),
            examplePhotoUrl: item.examplePhotoUrl,
          }))
        : [{ clientId: createId(), value: "", completionPhotoMode: "NONE" }],
    );
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
    setItems((prev) => [...prev, { clientId: createId(), value: "", completionPhotoMode: "NONE" }]);
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

  const handleItemPhotoModeChange = useCallback((clientId: string, value: ChecklistPhotoMode) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.examplePreviewUrl && value === "NONE") {
          URL.revokeObjectURL(item.examplePreviewUrl);
        }
        const nextItem = { ...item, completionPhotoMode: value };
        return value === "NONE" ? clearExamplePhoto(nextItem) : nextItem;
      }),
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
      completionPhotoMode: entry.item.completionPhotoMode,
      completionPhotoRequired: entry.item.completionPhotoMode === "REQUIRED",
    }));
    const exampleFiles = normalizedItems
      .map((entry, index) =>
        entry.item.exampleFile && entry.item.completionPhotoMode !== "NONE"
          ? { index, file: entry.item.exampleFile }
          : null,
      )
      .filter((entry): entry is { index: number; file: File } => Boolean(entry));
    const examplePhotoDeletes = normalizedItems
      .map((entry) =>
        entry.item.id &&
        (entry.item.removeExamplePhoto || (entry.item.completionPhotoMode === "NONE" && entry.item.examplePhotoUrl))
          ? entry.item.id
          : null,
      )
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
    buildResetTime,
    content,
    isTrackable,
    items,
    kind,
    name,
    onSubmit,
    periodicity,
    positionFields,
    resetDayOfMonth,
    resetDayOfWeek,
  ]);

  return {
    kind,
    name,
    content,
    periodicity,
    resetHour,
    resetMinute,
    resetDayOfWeek,
    resetDayOfMonth,
    positionFields,
    items,
    localError,
    positionOptions,
    isTrackable,
    setKind,
    setName,
    setContent,
    setPeriodicity,
    setResetHour,
    setResetMinute,
    setResetDayOfWeek,
    setResetDayOfMonth,
    handleAddPosition,
    handleRemovePosition,
    handlePositionChange,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleItemPhotoModeChange,
    handleExampleFileChange,
    handleRemoveExamplePhoto,
    handleSubmit,
  };
}
