import { cn } from "../../../../shared/lib/cn";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";

export type EditableColumnId = "name" | "previousQty" | "incomingQty" | "currentQty" | "unitPrice";

export type EditableColumn = {
  id: EditableColumnId;
};

export type InventoryTableHeader = {
  label: string;
  className: string;
};

export const EDITABLE_COLUMNS: EditableColumn[] = [
  { id: "name" },
  { id: "previousQty" },
  { id: "incomingQty" },
  { id: "currentQty" },
  { id: "unitPrice" },
];

export const INVENTORY_TABLE_HEADERS: InventoryTableHeader[] = [
  {
    label: "№",
    className:
      "border-subtle bg-surface text-muted sticky top-0 left-0 z-40 w-11 border-r border-b px-2 py-2 text-center text-xs font-semibold sm:w-12",
  },
  {
    label: "Фото",
    className:
      "border-subtle bg-surface text-muted sticky top-0 left-11 z-40 w-[88px] border-r border-b px-2 py-2 text-xs font-semibold sm:left-12 sm:w-[96px] sm:px-3",
  },
  {
    label: "Название",
    className:
      "border-subtle bg-surface text-muted sticky top-0 left-[132px] z-40 w-[168px] border-r border-b px-3 py-2 text-xs font-semibold sm:left-[144px] sm:w-[300px]",
  },
  {
    label: "Было",
    className:
      "border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold",
  },
  {
    label: "Приход",
    className:
      "border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold",
  },
  {
    label: "Стало",
    className:
      "border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold",
  },
  {
    label: "Цена",
    className:
      "border-subtle bg-surface text-muted sticky top-0 z-30 w-[136px] border-r border-b px-3 py-2 text-xs font-semibold",
  },
  {
    label: "Итог",
    className:
      "border-subtle bg-surface text-muted sticky top-0 z-30 w-[180px] border-r border-b px-3 py-2 text-xs font-semibold",
  },
  {
    label: "Краткая инфа",
    className:
      "border-subtle bg-surface text-muted sticky top-0 z-30 w-[322px] border-b px-3 py-2 text-xs font-semibold",
  },
];

export const INVENTORY_TABLE_COLUMN_COUNT = INVENTORY_TABLE_HEADERS.length;

export const cellInputClassName =
  "h-10 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2.5 text-[16px] outline-none transition focus:border-[color:var(--staffly-border)] focus:bg-[color:var(--staffly-surface)] focus:ring-2 focus:ring-inset focus:ring-[var(--staffly-ring)] disabled:cursor-default disabled:opacity-100";

export const numericCellInputClassName = cn(
  cellInputClassName,
  "overflow-hidden text-right tabular-nums whitespace-nowrap",
);

export const ADD_DOCK_REVEAL_START_PX = 12;
export const ADD_DOCK_REVEAL_DISTANCE_PX = 96;

export function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function getCellId(item: DishwareInventoryEditableItem, column: EditableColumn) {
  return `${item.clientId}:${column.id}`;
}
