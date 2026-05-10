import { cn } from "../../../../shared/lib/cn";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";

export type EditableColumnId = "name" | "previousQty" | "incomingQty" | "currentQty" | "unitPrice";

export type EditableColumn = {
  id: EditableColumnId;
};

export const EDITABLE_COLUMNS: EditableColumn[] = [
  { id: "name" },
  { id: "previousQty" },
  { id: "incomingQty" },
  { id: "currentQty" },
  { id: "unitPrice" },
];

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
