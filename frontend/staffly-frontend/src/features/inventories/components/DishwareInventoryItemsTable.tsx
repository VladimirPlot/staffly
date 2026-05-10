import { ImagePlus, MoreVertical, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { cn } from "../../../shared/lib/cn";
import { useGridNavigation } from "../../../shared/ui/gridNavigation/useGridNavigation";
import Button from "../../../shared/ui/Button";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Icon from "../../../shared/ui/Icon";
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
  onAddItem: () => string;
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

const ADD_DOCK_REVEAL_START_PX = 12;
const ADD_DOCK_REVEAL_DISTANCE_PX = 96;

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

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
        tone === "loss" &&
        "border-[color:var(--staffly-loss-border)] bg-[color:var(--staffly-loss-bg)] text-[color:var(--staffly-loss-text)]",
        tone === "gain" &&
        "border-[color:var(--staffly-gain-border)] bg-[color:var(--staffly-gain-bg)] text-[color:var(--staffly-gain-text)]",
      )}
    >
      <span className="text-muted shrink-0 font-normal">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

function PhotoMenuAction({
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
        "hover:bg-app flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        tone === "danger" ? "text-[color:var(--staffly-loss-text)]" : "text-default",
      )}
      onClick={onClick}
    >
      <Icon icon={icon} size="xs" decorative className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function PhotoMenuIconAction({
  label,
  icon,
  onClick,
  tone = "default",
}: {
  label: string;
  icon: typeof ImagePlus;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-xl transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        tone === "danger"
          ? "text-[color:var(--staffly-loss-text)] hover:bg-[color:var(--staffly-loss-bg)]"
          : "text-icon hover:bg-app",
      )}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon icon={icon} size="xs" decorative />
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
  onCellKeyDown: (
    event: KeyboardEvent<HTMLElement>,
    cell: { rowIndex: number; colIndex: number; cellId: string },
  ) => void;
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
  const hasPhoto = Boolean(item.photoUrl);
  const canChangePhoto = Boolean(item.id) && !readOnly && !uploading;

  const openFilePicker = () => {
    if (!canChangePhoto) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="group/photo relative flex min-h-[80px] items-center justify-center px-1 py-1.5 sm:min-h-[82px]">
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
        <div className="border-subtle bg-app relative h-16 w-16 overflow-hidden rounded-xl border sm:h-[68px] sm:w-[68px]">
          <img
            src={item.photoUrl!}
            alt={item.name.trim() || `Фото позиции ${index + 1}`}
            className="h-full w-full object-cover"
          />

          {canChangePhoto ? (
            <DropdownMenu
              open={photoMenuOpen}
              onOpenChange={onPhotoMenuOpenChange}
              alignClassName="right-0"
              menuClassName="w-9"
              mobileSheetTitle={item.name.trim() || `Позиция ${index + 1}`}
              mobileSheetSubtitle="Фото позиции"
              triggerWrapperClassName="absolute top-2 right-2 inline-flex sm:top-1 sm:right-1"
              trigger={(triggerProps) => (
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex h-7 w-7 touch-manipulation items-center justify-center rounded-lg border border-white/35 bg-black/30 text-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur-[3px] transition outline-none after:absolute after:-inset-2 after:content-[''] hover:border-white/45 hover:bg-black/42 focus:ring-2 focus:ring-white/80 focus:ring-offset-1 focus:ring-offset-black/20 active:scale-95 sm:h-5 sm:w-5 sm:rounded-md sm:after:-inset-1",
                    photoMenuOpen
                      ? "opacity-100"
                      : "opacity-100 sm:opacity-0 sm:group-hover/photo:opacity-100 sm:focus-visible:opacity-100",
                  )}
                  title="Действия с фото"
                  aria-label={`Действия с фото позиции ${index + 1}`}
                  {...triggerProps}
                >
                  <Icon icon={MoreVertical} size="xs" decorative />
                </button>
              )}
            >
              {({ close, isMobile }) =>
                isMobile ? (
                  <div className="space-y-1 pb-1">
                    <PhotoMenuAction
                      icon={Pencil}
                      onClick={() => {
                        close();
                        window.setTimeout(openFilePicker, 0);
                      }}
                    >
                      Заменить фото
                    </PhotoMenuAction>
                    <PhotoMenuAction
                      icon={Trash2}
                      tone="danger"
                      onClick={() => {
                        close();
                        if (item.id) onDeleteImage(item.id);
                      }}
                    >
                      Удалить фото
                    </PhotoMenuAction>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 p-0.5">
                    <PhotoMenuIconAction
                      label={`Заменить фото позиции ${index + 1}`}
                      icon={Pencil}
                      onClick={() => {
                        close();
                        window.setTimeout(openFilePicker, 0);
                      }}
                    />
                    <PhotoMenuIconAction
                      label={`Удалить фото позиции ${index + 1}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={() => {
                        close();
                        if (item.id) onDeleteImage(item.id);
                      }}
                    />
                  </div>
                )
              }
            </DropdownMenu>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "border-subtle bg-app text-muted flex h-16 w-16 items-center justify-center rounded-xl border transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] sm:h-[68px] sm:w-[68px]",
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

      {uploading ? (
        <span className="text-muted absolute inset-x-2 bottom-0.5 rounded-full bg-[color:var(--staffly-surface)]/95 px-1 text-center text-[10px] font-medium shadow-sm">
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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--staffly-loss-text)] transition outline-none hover:bg-[color:var(--staffly-loss-bg)] focus:ring-2 focus:ring-[var(--staffly-loss-border)] sm:h-8 sm:w-8"
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
  const [addDockProgress, setAddDockProgress] = useState(0);
  const [pendingFocusCellId, setPendingFocusCellId] = useState<string | null>(null);
  const topAddButtonRef = useRef<HTMLDivElement | null>(null);
  const noteItem = useMemo(() => items.find((item) => item.clientId === noteItemId) ?? null, [items, noteItemId]);
  const navigation = useGridNavigation({
    rows: items,
    cols: EDITABLE_COLUMNS,
    getCellId,
    isCellEditable: () => !readOnly,
    wrapTab: true,
  });

  useEffect(() => {
    if (readOnly) {
      setAddDockProgress(0);
      return;
    }

    const addButton = topAddButtonRef.current;
    if (!addButton) return;

    let frameId: number | null = null;
    const reducedMotionQuery =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const updateDockProgress = () => {
      frameId = null;
      const rect = addButton.getBoundingClientRect();
      const nextProgress = reducedMotionQuery?.matches
        ? Number(rect.bottom < 0)
        : clampProgress((ADD_DOCK_REVEAL_START_PX - rect.bottom) / ADD_DOCK_REVEAL_DISTANCE_PX);
      const roundedProgress = Math.round(nextProgress * 100) / 100;

      setAddDockProgress((currentProgress) =>
        Math.abs(currentProgress - roundedProgress) > 0.01 ? roundedProgress : currentProgress,
      );
    };

    const requestDockProgressUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateDockProgress);
    };

    requestDockProgressUpdate();
    window.addEventListener("scroll", requestDockProgressUpdate, { passive: true, capture: true });
    window.addEventListener("resize", requestDockProgressUpdate);
    reducedMotionQuery?.addEventListener("change", requestDockProgressUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", requestDockProgressUpdate, { capture: true });
      window.removeEventListener("resize", requestDockProgressUpdate);
      reducedMotionQuery?.removeEventListener("change", requestDockProgressUpdate);
    };
  }, [readOnly]);

  useEffect(() => {
    if (!pendingFocusCellId) return;

    let scrollFrame: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      navigation.focusCellById(pendingFocusCellId);
      scrollFrame = window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.scrollIntoView({ block: "center", inline: "nearest" });
        }
        setPendingFocusCellId(null);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
    };
  }, [items.length, navigation, pendingFocusCellId]);

  const handleAddItem = useCallback(() => {
    if (readOnly || saving) return;

    const clientId = onAddItem();
    setPendingFocusCellId(`${clientId}:name`);
  }, [onAddItem, readOnly, saving]);

  const addDockInteractive = addDockProgress > 0.9 && !saving;
  const addDockTranslateY = Math.round((1 - addDockProgress) * 18);
  const addDockScale = 0.96 + addDockProgress * 0.04;

  return (
    <section className={cn("space-y-3", !readOnly && "pb-[3.25rem]")} aria-label="Позиции инвентаризации">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-strong text-xl font-semibold">Позиции</h3>
          <div className="text-muted text-sm">Было / Приход / Стало</div>
        </div>
        {!readOnly ? (
          <div ref={topAddButtonRef} className="self-start sm:self-auto">
            <Button size="sm" className="min-h-11" disabled={saving} onClick={handleAddItem}>
              Добавить позицию
            </Button>
          </div>
        ) : null}
      </div>

      <div className="border-subtle bg-surface overflow-hidden rounded-[1.5rem] border shadow-[var(--staffly-shadow)]">
        <div
          className="overflow-auto"
          onScroll={() => {
            if (openPhotoMenuItemId) {
              setOpenPhotoMenuItemId(null);
            }
          }}
        >
          <table className="w-full min-w-[1308px] table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-subtle bg-surface text-muted sticky top-0 left-0 z-40 w-11 border-r border-b px-2 py-2 text-center text-xs font-semibold sm:w-12">
                  №
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 left-11 z-40 w-[88px] border-r border-b px-2 py-2 text-xs font-semibold sm:left-12 sm:w-[96px] sm:px-3">
                  Фото
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 left-[132px] z-40 w-[168px] border-r border-b px-3 py-2 text-xs font-semibold sm:left-[144px] sm:w-[300px]">
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
                  <td colSpan={9} className="text-muted px-4 py-8 text-center text-sm">
                    Позиции пока не добавлены.
                  </td>
                </tr>
              ) : null}

              {items.map((item, rowIndex) => {
                const metrics = computeDishwareItemMetrics(item);
                return (
                  <tr key={item.clientId} className="group">
                    <td className="border-subtle bg-surface text-muted group-hover:bg-app sticky left-0 z-20 w-11 border-r border-b text-center align-middle text-xs font-semibold tabular-nums sm:w-12">
                      {rowIndex + 1}
                    </td>
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-11 z-20 w-[88px] border-r border-b align-middle sm:left-12 sm:w-[96px]">
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
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-[132px] z-20 w-[168px] border-r border-b align-middle sm:left-[144px] sm:w-[300px]">
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
                          "mx-2 flex min-h-10 min-w-0 items-center justify-end overflow-hidden rounded-xl px-3 text-sm font-semibold whitespace-nowrap tabular-nums",
                          metrics.lossAmount > 0
                            ? "bg-[color:var(--staffly-loss-bg)] text-[color:var(--staffly-loss-text)]"
                            : "text-default",
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

      {!readOnly ? (
        <div
          className="pointer-events-none fixed inset-x-3 bottom-2 z-[60] flex justify-center pb-[env(safe-area-inset-bottom)] transition-[opacity,transform] duration-150 ease-out [will-change:opacity,transform] motion-reduce:transition-none"
          aria-hidden={!addDockInteractive}
          style={{
            opacity: addDockProgress,
            transform: `translate3d(0, ${addDockTranslateY}px, 0) scale(${addDockScale})`,
          }}
        >
          <button
            type="button"
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)] text-[color:var(--staffly-text-strong)] shadow-[0_12px_28px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[rgba(15,23,42,0.04)] transition outline-none hover:-translate-y-0.5 hover:border-[color:var(--staffly-divider)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.22),0_0_0_1px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:ring-offset-2 focus:ring-offset-[var(--staffly-bg)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
              addDockInteractive ? "pointer-events-auto" : "pointer-events-none",
            )}
            disabled={saving}
            tabIndex={addDockInteractive ? undefined : -1}
            aria-label="Добавить позицию"
            onClick={handleAddItem}
          >
            <Icon icon={Plus} size="sm" decorative />
          </button>
        </div>
      ) : null}

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
