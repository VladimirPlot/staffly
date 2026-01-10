import React from "react";

import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import Button from "../../../shared/ui/Button";
import type { NotificationRequest } from "../api";
import type { PositionDto } from "../../dictionaries/api";

type PositionField = { id: string; value: number | "" };

type NotificationDialogProps = {
  open: boolean;
  title: string;
  positions: PositionDto[];
  submitting: boolean;
  submitLabel?: string;
  error?: string | null;
  initialData?: { content: string; expiresAt: string; positionIds: number[] };
  onClose: () => void;
  onSubmit: (payload: NotificationRequest) => void;
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

const NotificationDialog: React.FC<NotificationDialogProps> = ({
  open,
  title,
  positions,
  submitting,
  submitLabel = "Сохранить",
  error,
  initialData,
  onClose,
  onSubmit,
}) => {
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [content, setContent] = React.useState(initialData?.content ?? "");
  const [expiresAt, setExpiresAt] = React.useState(initialData?.expiresAt ?? today);
  const [fields, setFields] = React.useState<PositionField[]>([{ id: createId(), value: "" }]);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setContent(initialData?.content ?? "");
    setExpiresAt(initialData?.expiresAt ?? today);
    if (initialData?.positionIds && initialData.positionIds.length > 0) {
      setFields(initialData.positionIds.map((id) => ({ id: createId(), value: id })));
    } else {
      setFields([{ id: createId(), value: "" }]);
    }
    setLocalError(null);
  }, [open, initialData?.content, initialData?.expiresAt, initialData?.positionIds, today]);

  React.useEffect(() => {
    if (!open) {
      setFields([]);
    }
  }, [open]);

  const positionOptions = React.useMemo(
    () => [...positions].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [positions],
  );

  const handleAdd = React.useCallback(() => {
    setFields((prev) => [...prev, { id: createId(), value: "" }]);
  }, []);

  const handleRemove = React.useCallback((id: string) => {
    setFields((prev) => (prev.length <= 1 ? prev : prev.filter((field) => field.id !== id)));
  }, []);

  const handleChange = React.useCallback((id: string, value: string) => {
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, value: value ? Number(value) : "" } : field)),
    );
  }, []);

  const handleSubmit = React.useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      setLocalError("Добавьте текст уведомления");
      return;
    }
    const dateValue = expiresAt?.trim();
    if (!dateValue) {
      setLocalError("Выберите дату окончания");
      return;
    }
    const selectedIds = fields
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
    setLocalError(null);
    onSubmit({
      content: trimmed,
      expiresAt: dateValue,
      positionIds: uniqueIds,
    });
  }, [content, expiresAt, fields, onSubmit]);

  const effectiveError = error || localError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отменить
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохраняем…" : submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-sm text-zinc-600">Должности</div>
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center gap-3">
                <select
                  className="flex-1 rounded-2xl border border-zinc-300 p-2 text-base"
                  value={field.value}
                  onChange={(event) => handleChange(field.id, event.target.value)}
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
                  onClick={() => handleRemove(field.id)}
                  disabled={fields.length <= 1 || submitting}
                  className="text-sm text-zinc-600"
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={handleAdd} disabled={submitting} className="mt-2 text-sm">
            Добавить должность
          </Button>
        </div>

        <Input
          label="Дата окончания"
          type="date"
          min={today}
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          disabled={submitting}
        />

        <Textarea
          label="Уведомление"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          disabled={submitting}
          className="resize-y"
        />

        {effectiveError && <div className="text-sm text-red-600">{effectiveError}</div>}
      </div>
    </Modal>
  );
};

export default NotificationDialog;
