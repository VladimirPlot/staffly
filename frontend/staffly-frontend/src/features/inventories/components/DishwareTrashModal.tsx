import { FileText, Folder } from "lucide-react";

import TrashModal, { type TrashModalItem } from "../../../shared/ui/TrashModal";
import { formatDateFromIso } from "../../../shared/utils/date";
import type { DishwareInventoryFolderDto, DishwareInventorySummaryDto } from "../api";
import { sortFolders } from "../dishwareInventoryFolders";

type DishwareTrashObject =
  | { kind: "folder"; value: DishwareInventoryFolderDto }
  | { kind: "inventory"; value: DishwareInventorySummaryDto };

export default function DishwareTrashModal({
  open,
  folders,
  inventories,
  loading,
  error,
  actionLoading,
  onClose,
  onRestoreFolder,
  onRestoreInventory,
  onDeleteFolder,
  onDeleteInventory,
  onDeleteAll,
}: {
  open: boolean;
  folders: DishwareInventoryFolderDto[];
  inventories: DishwareInventorySummaryDto[];
  loading: boolean;
  error: string | null;
  actionLoading: string | null;
  onClose: () => void;
  onRestoreFolder: (folder: DishwareInventoryFolderDto) => void;
  onRestoreInventory: (inventory: DishwareInventorySummaryDto) => void;
  onDeleteFolder: (folder: DishwareInventoryFolderDto) => void;
  onDeleteInventory: (inventory: DishwareInventorySummaryDto) => void;
  onDeleteAll: () => void;
}) {
  const trashedFolders = folders.filter((folder) => folder.trashedAt).sort(sortFolders);
  const items: Array<TrashModalItem<DishwareTrashObject["kind"], DishwareTrashObject>> = [
    ...trashedFolders.map((folder) => ({
      key: `folder-${folder.id}`,
      kind: "folder" as const,
      value: { kind: "folder" as const, value: folder },
      typeLabel: "Папка",
      typePluralLabel: "Папки",
      title: folder.name,
      description: folder.description,
      icon: Folder,
      restoreActionKey: `restore-folder-${folder.id}`,
      deleteActionKey: `delete-folder-${folder.id}`,
    })),
    ...inventories.map((inventory) => ({
      key: `inventory-${inventory.id}`,
      kind: "inventory" as const,
      value: { kind: "inventory" as const, value: inventory },
      typeLabel: "Инвентаризация",
      typePluralLabel: "Инвентаризации",
      title: inventory.title,
      meta: `Дата: ${formatDateFromIso(inventory.inventoryDate)}`,
      icon: FileText,
      restoreActionKey: `restore-inventory-${inventory.id}`,
      deleteActionKey: `delete-inventory-${inventory.id}`,
    })),
  ];

  return (
    <TrashModal
      open={open}
      title="Корзина"
      items={items}
      loading={loading}
      error={error}
      actionLoading={actionLoading}
      onClose={onClose}
      onRestore={(item) => {
        if (item.value.kind === "folder") onRestoreFolder(item.value.value);
        else onRestoreInventory(item.value.value);
      }}
      onDelete={(item) => {
        if (item.value.kind === "folder") onDeleteFolder(item.value.value);
        else onDeleteInventory(item.value.value);
      }}
      onDeleteAll={onDeleteAll}
    />
  );
}
