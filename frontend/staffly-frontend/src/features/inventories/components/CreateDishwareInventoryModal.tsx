import { useEffect, useMemo, useState } from "react";

import Button from "../../../shared/ui/Button";
import DateFieldInput from "../../../shared/ui/DateFieldInput";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import { formatDateFromIso, formatDateInput, isValidIsoDate, toIsoDate } from "../../../shared/utils/date";
import type { CreateDishwareInventoryRequest, DishwareInventorySummaryDto } from "../api";

type Props = {
  open: boolean;
  sourceOptions: DishwareInventorySummaryDto[];
  initialFolderId?: number | null;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateDishwareInventoryRequest) => Promise<void> | void;
};

type Mode = "empty" | "copy";

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CreateDishwareInventoryModal({
  open,
  sourceOptions,
  initialFolderId = null,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [inventoryDate, setInventoryDate] = useState(getTodayIsoDate());
  const [comment, setComment] = useState("");
  const [mode, setMode] = useState<Mode>("empty");
  const [sourceInventoryId, setSourceInventoryId] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setInventoryDate(getTodayIsoDate());
    setComment("");
    setMode("empty");
    setSourceInventoryId("");
  }, [open]);

  const hasSourceOptions = sourceOptions.length > 0;
  const normalizedInventoryDate = isValidIsoDate(inventoryDate) ? inventoryDate : (toIsoDate(inventoryDate) ?? "");
  const canSubmit = Boolean(normalizedInventoryDate && (mode === "empty" || sourceInventoryId));
  const footer = useMemo(
    () => (
      <>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button
          onClick={() => {
            if (!canSubmit) return;
            void onSubmit({
              title: title.trim() || null,
              inventoryDate: normalizedInventoryDate,
              folderId: initialFolderId,
              sourceInventoryId: mode === "copy" && sourceInventoryId ? Number(sourceInventoryId) : null,
              comment: comment.trim() || null,
            });
          }}
          disabled={!canSubmit}
          isLoading={submitting}
        >
          Создать
        </Button>
      </>
    ),
    [
      canSubmit,
      comment,
      initialFolderId,
      mode,
      normalizedInventoryDate,
      onClose,
      onSubmit,
      sourceInventoryId,
      submitting,
      title,
    ],
  );

  return (
    <Modal
      open={open}
      title="Создание инвентаризации посуды"
      description="Выберите способ старта и заполните документ."
      onClose={onClose}
      footer={footer}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <DropdownSelect
          label="Как начать"
          value={mode}
          onChange={(event) => setMode((event.target.value as Mode) || "empty")}
          renderOption={(option) => (
            <div className="min-w-0">
              <div className="truncate text-sm text-default">{option.label}</div>
            </div>
          )}
        >
          <option value="empty">С нуля</option>
          <option value="copy" disabled={!hasSourceOptions}>
            По прошлой инвентаризации
          </option>
        </DropdownSelect>

        {mode === "copy" && (
          <DropdownSelect
            label="Источник"
            value={sourceInventoryId}
            onChange={(event) => setSourceInventoryId(event.target.value)}
            placeholder="Выберите прошлый документ"
          >
            <option value="">Выберите документ</option>
            {sourceOptions.map((inventory) => (
              <option key={inventory.id} value={inventory.id}>
                {inventory.title}
              </option>
            ))}
          </DropdownSelect>
        )}

        <DateFieldInput
          label="Дата"
          labelClassName="mb-0.5 text-xs font-medium"
          inputClassName="h-9 rounded-xl px-3 py-0 pr-10 text-sm"
          buttonClassName="right-1.5 !h-7 !w-7 rounded-lg border-0 bg-transparent shadow-none hover:bg-[color:var(--staffly-control-hover)] [&_svg]:size-4"
          value={formatDateFromIso(inventoryDate)}
          onChange={(event) => setInventoryDate(formatDateInput(event.target.value))}
          inputProps={{ maxLength: 10 }}
          nativeValue={normalizedInventoryDate}
          onNativeChange={(event) => setInventoryDate(event.target.value)}
        />

        <Input
          label="Название"
          labelClassName="mb-0.5 text-xs font-medium"
          className="h-9 rounded-xl px-3"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например, инвентаризация посуды за апрель"
        />

        <Textarea
          label="Примечание"
          labelClassName="mb-0.5 text-xs font-medium"
          className="rounded-xl px-3 py-2.5"
          value={comment}
          maxLength={5000}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Например: сверка по смене или залу"
        />

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </Modal>
  );
}
