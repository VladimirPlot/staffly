import type { LucideIcon } from "lucide-react";

import type { DishwareInventoryFolderDto, DishwareInventorySummaryDto } from "./api";

export type FolderModalState =
  | { mode: "create"; parentId: number | null; folder?: null }
  | { mode: "edit"; parentId: number | null; folder: DishwareInventoryFolderDto };

export type MoveTarget =
  | { kind: "folder"; id: number; title: string }
  | { kind: "inventory"; id: number; title: string };

export type DishwareObject =
  | { kind: "folder"; id: number; sortOrder: number; folder: DishwareInventoryFolderDto }
  | { kind: "inventory"; id: number; sortOrder: number; inventory: DishwareInventorySummaryDto };

export type PermanentDeleteTarget =
  | { kind: "folder"; id: number; title: string }
  | { kind: "inventory"; id: number; title: string }
  | { kind: "all"; title: string };

export type InventoryAction = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};
