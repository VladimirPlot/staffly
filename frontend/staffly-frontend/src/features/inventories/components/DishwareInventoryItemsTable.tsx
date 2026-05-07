import { ImagePlus, MoreVertical, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

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
  formatCompactInventoryMoney,
  formatCompactInventoryNumber,
  formatDishwareCountInputValue,
  formatDishwareMoneyInputValue,
  formatInventoryCount,
  formatInventoryLossAmount,
  formatInventoryLossCount,
  parseDishwareCountInput,
  parseDishwareMoneyInput,
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
  "h-10 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2.5 text-[16px] outline-none transition focus:border-[color:var(--staffly-border)] focus:bg-[color:var(--staffly-surface)] focus:ring-2 focus:ring-inset focus:ring-[var(--staffly-ring)] disabled:cursor-default disabled:opacity-100";

const numericCellInputClassName = cn(cellInputClassName, "overflow-hidden text-right tabular-nums whitespace-nowrap");

function getCellId(item: DishwareInventoryTableItem, column: EditableColumn) {
  return `${item.clientId}:${column.id}`;
}

function InfoPill({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: string;
  tone?: "default" | "loss" | "gain";
  title?: string;
}) {
  return (
    <span
      title={title ?? `${label} ${value}`}
      className={cn(
        "inline-flex min-h-6 max-w-full min-w-0 items-center gap-1 rounded-lg border px-1.5 text-[11px] font-medium tabular-nums",
        tone === "default" && "border-subtle text-default bg-[color:var(--staffly-control)]",
        tone === "loss" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20",
        tone === "gain" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20",
      )}
    >
      <span className="text-muted shrink-0 font-normal">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
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

function NumericCell<TValue extends number | null>({
  value,
  disabled,
  inputMode,
  placeholder,
  cellId,
  rowIndex,
  colIndex,
  registerCellRef,
  onCellKeyDown,
  formatValue,
  parseValue,
  onCommit,
}: {
  value: TValue;
  disabled: boolean;
  inputMode: "numeric" | "decimal";
  placeholder?: string;
  cellId: string;
  rowIndex: number;
  colIndex: number;
  registerCellRef: (cellId: string) => (el: HTMLElement | null) => void;
  onCellKeyDown: (event: KeyboardEvent<HTMLElement>, cell: { rowIndex: number; colIndex: number; cellId: string }) => void;
  formatValue: (value: TValue) => string;
  parseValue: (value: string) => TValue;
  onCommit: (value: TValue) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(() => formatValue(value));

  useEffect(() => {
    if (!focused) {
      setLocalValue(formatValue(value));
    }
  }, [focused, formatValue, value]);

  const commitValue = () => {
    const parsed = parseValue(localValue);
    setFocused(false);
    setLocalValue(formatValue(parsed));
    onCommit(parsed);
  };

  return (
    <input
      className={numericCellInputClassName}
      type="text"
      inputMode={inputMode}
      value={localValue}
      disabled={disabled}
      placeholder={placeholder}
      ref={registerCellRef(cellId)}
      onFocus={() => setFocused(true)}
      onBlur={commitValue}
      onKeyDown={(event) => onCellKeyDown(event, { rowIndex, colIndex, cellId })}
      onChange={(event) => setLocalValue(event.target.value)}
    />
  );
}

function PhotoCell({
  item,
  index,
  uploading,
  readOnly,
  photoMenuOpen,
  onPhotoMenuOpenChange,
  onUploadImage,
  onDeleteImage,
}: {
  item: DishwareInventoryTableItem;
  index: number;
  uploading: boolean;
  readOnly: boolean;
  photoMenuOpen: boolean;
  onPhotoMenuOpenChange: (open: boolean) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoMenuAnchorRef = useRef<HTMLSpanElement | null>(null);
  const hasPhoto = Boolean(item.photoUrl);
  const canChangePhoto = Boolean(item.id) && !readOnly && !uploading;

  const openFilePicker = () => {
    if (!canChangePhoto) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="relative flex min-h-[80px] items-center justify-center px-1.5 py-1.5 sm:min-h-[82px] sm:px-2">
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
        <div className="border-subtle bg-app relative h-14 w-14 overflow-hidden rounded-xl border sm:h-16 sm:w-16">
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
            "border-subtle bg-app text-muted flex h-14 w-14 items-center justify-center rounded-xl border transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
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
          open={photoMenuOpen}
          onOpenChange={onPhotoMenuOpenChange}
          positionAnchorRef={photoMenuAnchorRef}
          menuClassName="w-52"
          mobileSheetTitle={item.name.trim() || `Позиция ${index + 1}`}
          mobileSheetSubtitle="Фото позиции"
          triggerWrapperClassName="absolute top-1 right-1 inline-flex"
          trigger={(triggerProps) => (
            <span ref={photoMenuAnchorRef} className="inline-flex">
              <IconButton
                variant="unstyled"
                className="border-subtle bg-surface/95 text-default hover:bg-app h-10 w-10 border shadow-sm backdrop-blur"
                title="Действия с фото"
                aria-label={`Действия с фото позиции ${index + 1}`}
                {...triggerProps}
              >
                <Icon icon={MoreVertical} size="xs" decorative />
              </IconButton>
            </span>
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
  const diffTitle =
    metrics.diff < 0
      ? formatInventoryLossCount(metrics.diff)
      : metrics.diff > 0
        ? `+${formatInventoryCount(metrics.diff)}`
        : "0";
  const diffValue =
    metrics.diff < 0
      ? formatCompactInventoryNumber(metrics.diff)
      : metrics.diff > 0
        ? `+${formatCompactInventoryNumber(metrics.diff)}`
        : "0";
  const diffLabel = metrics.diff < 0 ? "недостача" : metrics.diff > 0 ? "излишек" : "ровно";
  const lossAmountTitle = formatInventoryLossAmount(metrics.lossAmount);
  const expectedTitle = formatInventoryCount(metrics.expectedQty);

  return (
    <div className="flex min-h-14 min-w-0 flex-col justify-center gap-1 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoPill label={diffLabel} value={diffValue} tone={diffTone} title={`${diffLabel} ${diffTitle}`} />
        <InfoPill
          label="потери"
          value={formatCompactInventoryMoney(metrics.lossAmount)}
          tone={metrics.lossAmount > 0 ? "loss" : "default"}
          title={`потери ${lossAmountTitle}`}
        />
        <InfoPill
          label="ожид."
          value={formatCompactInventoryNumber(metrics.expectedQty)}
          title={`ожид. ${expectedTitle}`}
        />
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
  const [openPhotoMenuItemId, setOpenPhotoMenuItemId] = useState<string | null>(null);
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
        <div
          className="max-h-[calc(100vh-320px)] overflow-auto"
          onScroll={() => {
            if (openPhotoMenuItemId) {
              setOpenPhotoMenuItemId(null);
            }
          }}
        >
          <table className="w-full min-w-[1260px] table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-subtle bg-surface text-muted sticky top-0 left-0 z-40 w-[88px] border-r border-b px-2 py-2 text-xs font-semibold sm:w-[96px] sm:px-3">
                  Фото
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 left-[88px] z-40 w-[168px] border-r border-b px-3 py-2 text-xs font-semibold sm:left-[96px] sm:w-[300px]">
                  Название
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Было
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Приход
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Стало
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[136px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Цена
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[180px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Итог
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[322px] border-b px-3 py-2 text-xs font-semibold">
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
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-0 z-20 w-[88px] border-r border-b align-middle sm:w-[96px]">
                      <PhotoCell
                        item={item}
                        index={rowIndex}
                        uploading={uploadingItemId === item.id}
                        readOnly={readOnly}
                        photoMenuOpen={openPhotoMenuItemId === item.clientId}
                        onPhotoMenuOpenChange={(open) => setOpenPhotoMenuItemId(open ? item.clientId : null)}
                        onUploadImage={onUploadImage}
                        onDeleteImage={onDeleteImage}
                      />
                    </td>
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-[88px] z-20 w-[168px] border-r border-b align-middle sm:left-[96px] sm:w-[300px]">
                      <div className="flex min-h-[80px] min-w-0 items-center sm:min-h-[82px]">
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
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="numeric"
                        disabled={readOnly}
                        value={item.previousQty}
                        cellId={getCellId(item, EDITABLE_COLUMNS[1])}
                        rowIndex={rowIndex}
                        colIndex={1}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareCountInputValue}
                        parseValue={parseDishwareCountInput}
                        onCommit={(previousQty) => onChange(item.clientId, { previousQty })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="numeric"
                        disabled={readOnly}
                        value={item.incomingQty}
                        cellId={getCellId(item, EDITABLE_COLUMNS[2])}
                        rowIndex={rowIndex}
                        colIndex={2}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareCountInputValue}
                        parseValue={parseDishwareCountInput}
                        onCommit={(incomingQty) => onChange(item.clientId, { incomingQty })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="numeric"
                        disabled={readOnly}
                        value={item.currentQty}
                        cellId={getCellId(item, EDITABLE_COLUMNS[3])}
                        rowIndex={rowIndex}
                        colIndex={3}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareCountInputValue}
                        parseValue={parseDishwareCountInput}
                        onCommit={(currentQty) => onChange(item.clientId, { currentQty })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="decimal"
                        disabled={readOnly}
                        placeholder="0,00"
                        value={item.unitPrice ?? null}
                        cellId={getCellId(item, EDITABLE_COLUMNS[4])}
                        rowIndex={rowIndex}
                        colIndex={4}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareMoneyInputValue}
                        parseValue={parseDishwareMoneyInput}
                        onCommit={(unitPrice) => onChange(item.clientId, { unitPrice })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <div
                        title={formatInventoryLossAmount(metrics.lossAmount)}
                        className={cn(
                          "mx-2 flex min-h-10 min-w-0 items-center justify-end overflow-hidden rounded-xl px-3 text-sm font-semibold tabular-nums whitespace-nowrap",
                          lossAmountTone,
                          metrics.lossAmount > 0 && "bg-red-50 dark:bg-red-950/20",
                        )}
                      >
                        <span className="min-w-0 truncate">{formatCompactInventoryMoney(metrics.lossAmount)}</span>
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
