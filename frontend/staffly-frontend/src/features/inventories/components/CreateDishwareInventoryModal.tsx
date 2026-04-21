import { useEffect, useMemo, useState } from "react";

import Button from "../../../shared/ui/Button";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import type { CreateDishwareInventoryRequest, DishwareInventorySummaryDto } from "../api";

type Props = {
  open: boolean;
  sourceOptions: DishwareInventorySummaryDto[];
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
  const canSubmit = inventoryDate && (mode === "empty" || sourceInventoryId);
  const footer = useMemo(
    () => (
      <>
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button onClick={() => {
          if (!canSubmit) return;
          void onSubmit({
            title: title.trim() || null,
            inventoryDate,
            sourceInventoryId: mode === "copy" && sourceInventoryId ? Number(sourceInventoryId) : null,
            comment: comment.trim() || null,
          });
        }} disabled={!canSubmit} isLoading={submitting}>
          Создать
        </Button>
      </>
    ),
    [canSubmit, comment, inventoryDate, mode, onClose, onSubmit, sourceInventoryId, submitting, title],
  );

  return (
    <Modal
      open={open}
      title="Новая инвентаризация посуды"
      description="Можно начать с пустого документа или взять за основу прошлую инвентаризацию."
      onClose={onClose}
      footer={footer}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <DropdownSelect
          label="Как начать"
          value={mode}
          onChange={(event) => setMode((event.target.value as Mode) || "empty")}
        >
          <option value="empty">С пустой инвентаризации</option>
          <option value="copy" disabled={!hasSourceOptions}>На основе прошлой</option>
        </DropdownSelect>

        {mode === "copy" && (
          <DropdownSelect
            label="Откуда скопировать позиции"
            value={sourceInventoryId}
            onChange={(event) => setSourceInventoryId(event.target.value)}
            placeholder="Выбери прошлую инвентаризацию"
          >
            <option value="">Выбери инвентаризацию</option>
            {sourceOptions.map((inventory) => (
              <option key={inventory.id} value={inventory.id}>
                {inventory.title}
              </option>
            ))}
          </DropdownSelect>
        )}

        <Input
          label="Дата инвентаризации"
          type="date"
          value={inventoryDate}
          onChange={(event) => setInventoryDate(event.target.value)}
        />

        <Input
          label="Название"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Если пусто, система подставит название сама"
        />

        <Textarea
          label="Комментарий"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          placeholder="Например: ежемесячная сверка по залу"
        />

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </Modal>
  );
}
