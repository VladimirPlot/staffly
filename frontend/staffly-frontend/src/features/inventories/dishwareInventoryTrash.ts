import type { DishwareInventoryFolderDto, DishwareInventorySummaryDto } from "./api";
import { descendantIds, rootTrashedFolders } from "./dishwareInventoryFolders";

export function buildDishwareTrashDeleteAllPlan(
  folders: DishwareInventoryFolderDto[],
  inventories: DishwareInventorySummaryDto[],
) {
  const folderRoots = rootTrashedFolders(folders);
  const deletedFolderIds = new Set<number>();

  folderRoots.forEach((folder) => {
    descendantIds(folder.id, folders).forEach((id) => deletedFolderIds.add(id));
  });

  return {
    folderRoots,
    inventoriesOutsideDeletedFolders: inventories.filter(
      (inventory) => inventory.folderId == null || !deletedFolderIds.has(inventory.folderId),
    ),
  };
}
