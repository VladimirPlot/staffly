import { Archive, FolderPlus, Plus } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { DishwareInventoryFolderDto } from "../api";

export default function DishwareInventoriesHeader({
  folder,
  onOpenTrash,
  onCreateFolder,
  onCreateInventory,
}: {
  folder: DishwareInventoryFolderDto | null;
  onOpenTrash: () => void;
  onCreateFolder: () => void;
  onCreateInventory: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold [overflow-wrap:anywhere]">{folder?.name ?? "Инвентаризации посуды"}</h2>
        <div className="text-muted text-sm">{folder?.description || "Папки и документы по посуде."}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon icon={Archive} size="sm" decorative />}
          onClick={onOpenTrash}
        >
          Корзина
        </Button>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon icon={FolderPlus} size="sm" decorative />}
          onClick={onCreateFolder}
        >
          Папка
        </Button>
        <Button
          size="sm"
          className="col-span-2 sm:col-span-1"
          leftIcon={<Icon icon={Plus} size="sm" decorative />}
          onClick={onCreateInventory}
        >
          Инвентаризация
        </Button>
      </div>
    </div>
  );
}
