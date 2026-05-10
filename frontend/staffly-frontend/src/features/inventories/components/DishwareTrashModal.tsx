import { Folder, RotateCcw, Trash2 } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import Modal from "../../../shared/ui/Modal";
import { formatDateFromIso } from "../../../shared/utils/date";
import type { DishwareInventoryFolderDto, DishwareInventorySummaryDto } from "../api";
import { sortFolders } from "../dishwareInventoryFolders";

export default function DishwareTrashModal({
  open,
  folders,
  inventories,
  loading,
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
  actionLoading: string | null;
  onClose: () => void;
  onRestoreFolder: (folder: DishwareInventoryFolderDto) => void;
  onRestoreInventory: (inventory: DishwareInventorySummaryDto) => void;
  onDeleteFolder: (folder: DishwareInventoryFolderDto) => void;
  onDeleteInventory: (inventory: DishwareInventorySummaryDto) => void;
  onDeleteAll: () => void;
}) {
  const trashedFolders = folders.filter((folder) => folder.trashedAt).sort(sortFolders);
  const hasItems = trashedFolders.length > 0 || inventories.length > 0;

  return (
    <Modal open={open} title="Корзина" onClose={onClose} className="max-w-3xl">
      <div className="space-y-3">
        {hasItems ? (
          <div className="border-subtle flex items-center justify-between gap-3 border-b pb-3">
            <div className="text-muted text-sm">{trashedFolders.length + inventories.length} элементов в корзине</div>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600"
              leftIcon={<Icon icon={Trash2} size="sm" decorative />}
              onClick={onDeleteAll}
            >
              Удалить все
            </Button>
          </div>
        ) : null}
        {loading ? <div className="text-muted text-sm">Загружаем корзину...</div> : null}
        {!loading && trashedFolders.length === 0 && inventories.length === 0 ? (
          <div className="text-muted text-sm">Корзина пуста.</div>
        ) : null}

        {trashedFolders.map((folder) => (
          <div key={`folder-${folder.id}`} className="border-subtle bg-app rounded-2xl border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <Icon icon={Folder} size="sm" decorative />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{folder.name}</span>
                </div>
                {folder.description ? <div className="text-muted mt-1 text-sm">{folder.description}</div> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  title="Восстановить"
                  aria-label={`Восстановить папку ${folder.name}`}
                  isLoading={actionLoading === `restore-folder-${folder.id}`}
                  leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
                  onClick={() => onRestoreFolder(folder)}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 text-red-600"
                  title="Удалить навсегда"
                  aria-label={`Удалить папку ${folder.name} навсегда`}
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  onClick={() => onDeleteFolder(folder)}
                />
              </div>
            </div>
          </div>
        ))}

        {inventories.map((inventory) => (
          <div key={`inventory-${inventory.id}`} className="border-subtle bg-app rounded-2xl border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium [overflow-wrap:anywhere]">{inventory.title}</div>
                <div className="text-muted mt-1 text-sm">Дата: {formatDateFromIso(inventory.inventoryDate)}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  title="Восстановить"
                  aria-label={`Восстановить документ ${inventory.title}`}
                  isLoading={actionLoading === `restore-inventory-${inventory.id}`}
                  leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
                  onClick={() => onRestoreInventory(inventory)}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 text-red-600"
                  title="Удалить навсегда"
                  aria-label={`Удалить документ ${inventory.title} навсегда`}
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  onClick={() => onDeleteInventory(inventory)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
