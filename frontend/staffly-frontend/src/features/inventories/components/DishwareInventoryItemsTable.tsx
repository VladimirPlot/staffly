import { ImagePlus, MoreVertical, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "../../../shared/lib/cn";
import { useGridNavigation } from "../../../shared/ui/gridNavigation/useGridNavigation";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import {
  computeDishwareItemMetrics,
  formatInventoryCount,
  formatInventoryLossAmount,
  formatInventoryLossCount,
} from "../utils";

export type DishwareInventoryTableItem = {
  clientId: string;
  id?: number;
  name: string;
  photoUrl?: string | null;
  previousQty: number;
  incomingQty: number;
  currentQty: number;
  unitPrice?: number | null;
  note?: string | null;
};

type DishwareInventoryItemsTableProps = {
  items: DishwareInventoryTableItem[];
  uploadingItemId: number | null;
  readOnly?: boolean;
  saving?: boolean;
  onAddItem: () => void;
  onChange: (clientId: string, patch: Partial<DishwareInventoryTableItem>) => void;
  onRemove: (clientId: string) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
};

type EditableColumnId = "name" | "previousQty" | "incomingQty" | "currentQty" | "unitPrice";

type EditableColumn = {
  id: EditableColumnId;
};

const EDITABLE_COLUMNS: EditableColumn[] = [
  { id: "name" },
  { id: "previousQty" },
  { id: "incomingQty" },
  { id: "currentQty" },
  { id: "unitPrice" },
];

const cellInputClassName =
  "h-10 w-full min-w-0 rounded-none border-0 bg-transparent px-2.5 text-[16px] outline-none transition focus:bg-[color:var(--staffly-surface)] focus:ring-2 focus:ring-[var(--staffly-ring)] disabled:cursor-default disabled:opacity-100";

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getCellId(item: DishwareInventoryTableItem, column: EditableColumn) {
  return `${item.clientId}:${column.id}`;
}

function InfoPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "loss" | "gain";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-lg border px-1.5 text-[11px] font-medium tabular-nums",
        tone === "default" && "border-subtle text-default bg-[color:var(--staffly-control)]",
        tone === "loss" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20",
        tone === "gain" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20",
      )}
    >
      <span className="text-muted font-normal">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function PhotoAction({
  children,
  icon,
  onClick,
  tone = "default",
}: {
  children: string;
  icon: typeof ImagePlus;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "hover:bg-app flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        tone === "danger" ? "text-red-600" : "text-default",
      )}
      onClick={onClick}
    >
      <Icon icon={icon} size="sm" decorative className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function PhotoCell({
  item,
  index,
  uploading,
  readOnly,
  onUploadImage,
  onDeleteImage,
}: {
  item: DishwareInventoryTableItem;
  index: number;
  uploading: boolean;
  readOnly: boolean;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasPhoto = Boolean(item.photoUrl);
  const canChangePhoto = Boolean(item.id) && !readOnly && !uploading;

  const openFilePicker = () => {
    if (!canChangePhoto) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="relative flex min-h-14 items-center justify-center px-1 py-1 sm:px-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !item.id) return;
          onUploadImage(item.id, file);
          event.target.value = "";
        }}
      />

      {hasPhoto ? (
        <div className="border-subtle bg-app relative h-11 w-11 overflow-hidden rounded-xl border">
          <img
            src={item.photoUrl!}
            alt={item.name.trim() || `Фото позиции ${index + 1}`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "border-subtle bg-app text-muted flex h-11 w-11 items-center justify-center rounded-xl border transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
            canChangePhoto ? "hover:bg-[color:var(--staffly-control-hover)]" : "cursor-default opacity-75",
          )}
          disabled={!canChangePhoto}
          title={item.id ? "Добавить фото" : "Фото можно добавить после сохранения"}
          aria-label={item.id ? `Добавить фото позиции ${index + 1}` : "Фото можно добавить после сохранения"}
          onClick={openFilePicker}
        >
          <Icon icon={ImagePlus} size="sm" decorative />
        </button>
      )}

      {canChangePhoto && hasPhoto ? (
        <DropdownMenu
          menuClassName="w-52"
          mobileSheetTitle={item.name.trim() || `Позиция ${index + 1}`}
          mobileSheetSubtitle="Фото позиции"
          triggerWrapperClassName="absolute top-1 right-1 inline-flex"
          trigger={(triggerProps) => (
            <IconButton
              variant="unstyled"
              className="border-subtle bg-surface/95 text-default hover:bg-app h-11 w-11 border shadow-sm backdrop-blur sm:h-9 sm:w-9"
              title="Действия с фото"
              aria-label={`Действия с фото позиции ${index + 1}`}
              {...triggerProps}
            >
              <Icon icon={MoreVertical} size="xs" decorative />
            </IconButton>
          )}
        >
          {({ close, isMobile }) => (
            <div className={isMobile ? "space-y-1 pb-1" : "space-y-1 p-1"}>
              <PhotoAction
                icon={Pencil}
                onClick={() => {
                  close();
                  window.setTimeout(openFilePicker, 0);
                }}
              >
                Заменить фото
              </PhotoAction>
              <PhotoAction
                icon={Trash2}
                tone="danger"
                onClick={() => {
                  close();
                  if (item.id) onDeleteImage(item.id);
                }}
              >
                Удалить фото
              </PhotoAction>
            </div>
          )}
        </DropdownMenu>
      ) : null}

      {uploading ? (
        <span className="text-muted absolute inset-x-2 bottom-1 rounded-full bg-[color:var(--staffly-surface)]/90 px-1 text-center text-[10px] font-medium shadow-sm">
          Фото...
        </span>
      ) : null}
    </div>
  );
}

function InfoCell({
  item,
  index,
  readOnly,
  onOpenNote,
  onRemove,
}: {
  item: DishwareInventoryTableItem;
  index: number;
  readOnly: boolean;
  onOpenNote: (clientId: string) => void;
  onRemove: (clientId: string) => void;
}) {
  const metrics = computeDishwareItemMetrics(item);
  const hasNote = Boolean(item.note?.trim());
  const diffTone = metrics.diff < 0 ? "loss" : metrics.diff > 0 ? "gain" : "default";
  const diffValue =
    metrics.diff < 0
      ? formatInventoryLossCount(metrics.diff)
      : metrics.diff > 0
        ? `+${formatInventoryCount(metrics.diff)}`
        : "0";
  const diffLabel = metrics.diff < 0 ? "недостача" : metrics.diff > 0 ? "излишек" : "ровно";

  return (
    <div className="flex min-h-14 min-w-0 flex-col justify-center gap-1 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoPill label={diffLabel} value={diffValue} tone={diffTone} />
        <InfoPill
          label="потери"
          value={formatInventoryLossAmount(metrics.lossAmount)}
          tone={metrics.lossAmount > 0 ? "loss" : "default"}
        />
        <InfoPill label="ожид." value={formatInventoryCount(metrics.expectedQty)} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] sm:min-h-7",
            hasNote
              ? "text-default bg-[color:var(--staffly-control-hover)]"
              : "text-muted bg-[color:var(--staffly-control)]",
            readOnly && !hasNote ? "cursor-default opacity-70" : "hover:bg-[color:var(--staffly-control-hover)]",
          )}
          disabled={readOnly && !hasNote}
          onClick={() => onOpenNote(item.clientId)}
        >
          <Icon icon={StickyNote} size="xs" decorative className="shrink-0" />
          <span className="truncate">{hasNote ? "Есть заметка" : "Заметка"}</span>
        </button>

        {!readOnly ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-600 transition outline-none hover:bg-red-50 focus:ring-2 focus:ring-red-200 sm:h-8 sm:w-8 dark:hover:bg-red-950/20"
            aria-label={`Удалить позицию ${index + 1}`}
            title="Удалить позицию"
            onClick={() => onRemove(item.clientId)}
          >
            <Icon icon={Trash2} size="sm" decorative />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function DishwareInventoryItemsTable({
  items,
  uploadingItemId,
  readOnly = false,
  saving = false,
  onAddItem,
  onChange,
  onRemove,
  onUploadImage,
  onDeleteImage,
}: DishwareInventoryItemsTableProps) {
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const noteItem = useMemo(() => items.find((item) => item.clientId === noteItemId) ?? null, [items, noteItemId]);
  const navigation = useGridNavigation({
    rows: items,
    cols: EDITABLE_COLUMNS,
    getCellId,
    isCellEditable: () => !readOnly,
    wrapTab: true,
  });

  return (
    <section className="space-y-3" aria-label="Позиции инвентаризации">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-strong text-xl font-semibold">Позиции</h3>
          <div className="text-muted text-sm">Было / Приход / Стало</div>
        </div>
        {!readOnly ? (
          <Button size="sm" className="min-h-11 self-start sm:self-auto" disabled={saving} onClick={onAddItem}>
            Добавить позицию
          </Button>
        ) : null}
      </div>

      <div className="border-subtle bg-surface overflow-hidden rounded-[1.5rem] border shadow-[var(--staffly-shadow)]">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-subtle bg-surface text-muted sticky top-0 left-0 z-40 w-14 border-r border-b px-2 py-2 text-xs font-semibold sm:w-[82px] sm:px-3">
                  Фото
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 left-14 z-40 w-[152px] border-r border-b px-3 py-2 text-xs font-semibold sm:left-[82px] sm:w-[280px]">
                  Название
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[116px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Было
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[116px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Приход
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[116px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Стало
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[124px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Цена
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[136px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Итог
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[250px] border-b px-3 py-2 text-xs font-semibold">
                  Краткая инфа
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted px-4 py-8 text-center text-sm">
                    Позиции пока не добавлены.
                  </td>
                </tr>
              ) : null}

              {items.map((item, rowIndex) => {
                const metrics = computeDishwareItemMetrics(item);
                const lossAmountTone = metrics.lossAmount > 0 ? "text-red-700" : "text-default";

                return (
                  <tr key={item.clientId} className="group">
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-0 z-20 w-14 border-r border-b align-middle sm:w-[82px]">
                      <PhotoCell
                        item={item}
                        index={rowIndex}
                        uploading={uploadingItemId === item.id}
                        readOnly={readOnly}
                        onUploadImage={onUploadImage}
                        onDeleteImage={onDeleteImage}
                      />
                    </td>
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-14 z-20 w-[152px] border-r border-b align-middle sm:left-[82px] sm:w-[280px]">
                      <div className="flex min-h-14 items-center">
                        <input
                          className={cn(cellInputClassName, "text-default font-medium")}
                          value={item.name}
                          disabled={readOnly}
                          placeholder="Название позиции"
                          ref={navigation.registerCellRef(getCellId(item, EDITABLE_COLUMNS[0]))}
                          onKeyDown={(event) =>
                            navigation.onCellKeyDown(event, {
                              rowIndex,
                              colIndex: 0,
                              cellId: getCellId(item, EDITABLE_COLUMNS[0]),
                            })
                          }
                          onChange={(event) => onChange(item.clientId, { name: event.target.value })}
                        />
                      </div>
                    </td>
                    <td className="border-subtle group-hover:bg-app border-r border-b align-middle">
                      <input
                        className={`${cellInputClassName} text-right tabular-nums`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(item.previousQty ?? 0)}
                        disabled={readOnly}
                        ref={navigation.registerCellRef(getCellId(item, EDITABLE_COLUMNS[1]))}
                        onKeyDown={(event) =>
                          navigation.onCellKeyDown(event, {
                            rowIndex,
                            colIndex: 1,
                            cellId: getCellId(item, EDITABLE_COLUMNS[1]),
                          })
                        }
                        onChange={(event) =>
                          onChange(item.clientId, { previousQty: parseNonNegativeNumber(event.target.value) })
                        }
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app border-r border-b align-middle">
                      <input
                        className={`${cellInputClassName} text-right tabular-nums`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(item.incomingQty ?? 0)}
                        disabled={readOnly}
                        ref={navigation.registerCellRef(getCellId(item, EDITABLE_COLUMNS[2]))}
                        onKeyDown={(event) =>
                          navigation.onCellKeyDown(event, {
                            rowIndex,
                            colIndex: 2,
                            cellId: getCellId(item, EDITABLE_COLUMNS[2]),
                          })
                        }
                        onChange={(event) =>
                          onChange(item.clientId, { incomingQty: parseNonNegativeNumber(event.target.value) })
                        }
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app border-r border-b align-middle">
                      <input
                        className={`${cellInputClassName} text-right tabular-nums`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={String(item.currentQty ?? 0)}
                        disabled={readOnly}
                        ref={navigation.registerCellRef(getCellId(item, EDITABLE_COLUMNS[3]))}
                        onKeyDown={(event) =>
                          navigation.onCellKeyDown(event, {
                            rowIndex,
                            colIndex: 3,
                            cellId: getCellId(item, EDITABLE_COLUMNS[3]),
                          })
                        }
                        onChange={(event) =>
                          onChange(item.clientId, { currentQty: parseNonNegativeNumber(event.target.value) })
                        }
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app border-r border-b align-middle">
                      <input
                        className={`${cellInputClassName} text-right tabular-nums`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={item.unitPrice ?? ""}
                        disabled={readOnly}
                        placeholder="0,00"
                        ref={navigation.registerCellRef(getCellId(item, EDITABLE_COLUMNS[4]))}
                        onKeyDown={(event) =>
                          navigation.onCellKeyDown(event, {
                            rowIndex,
                            colIndex: 4,
                            cellId: getCellId(item, EDITABLE_COLUMNS[4]),
                          })
                        }
                        onChange={(event) =>
                          onChange(item.clientId, {
                            unitPrice: event.target.value === "" ? null : parseNonNegativeNumber(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app border-r border-b align-middle">
                      <div
                        className={cn(
                          "mx-2 flex min-h-10 items-center justify-end rounded-xl px-3 text-sm font-semibold tabular-nums",
                          lossAmountTone,
                          metrics.lossAmount > 0 && "bg-red-50 dark:bg-red-950/20",
                        )}
                      >
                        {formatInventoryLossAmount(metrics.lossAmount)}
                      </div>
                    </td>
                    <td className="border-subtle group-hover:bg-app border-b align-middle">
                      <InfoCell
                        item={item}
                        index={rowIndex}
                        readOnly={readOnly}
                        onOpenNote={setNoteItemId}
                        onRemove={onRemove}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(noteItem)}
        title={noteItem?.name.trim() || "Заметка к позиции"}
        onClose={() => setNoteItemId(null)}
        className="max-w-xl"
        footer={
          <Button variant="outline" onClick={() => setNoteItemId(null)}>
            Готово
          </Button>
        }
      >
        {noteItem ? (
          <Textarea
            label="Заметка"
            labelClassName="sr-only"
            className="min-h-32 rounded-xl px-3 py-2"
            value={noteItem.note ?? ""}
            maxLength={5000}
            disabled={readOnly}
            rows={5}
            autoFocus={!readOnly}
            placeholder="Например, новая партия, бой, место хранения или комментарий по пересчету."
            onChange={(event) => onChange(noteItem.clientId, { note: event.target.value })}
          />
        ) : null}
      </Modal>
    </section>
  );
}
