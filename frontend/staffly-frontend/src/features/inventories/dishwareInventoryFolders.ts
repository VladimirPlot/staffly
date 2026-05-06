import type { DishwareInventoryFolderDto } from "./api";

export function sortFolders(a: DishwareInventoryFolderDto, b: DishwareInventoryFolderDto) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ru");
}

export function buildFolderChain(
  folder: DishwareInventoryFolderDto | null,
  folderMap: Map<number, DishwareInventoryFolderDto>,
) {
  const chain: DishwareInventoryFolderDto[] = [];
  const seen = new Set<number>();
  let cursor = folder;
  while (cursor && !seen.has(cursor.id)) {
    chain.unshift(cursor);
    seen.add(cursor.id);
    cursor = cursor.parentId == null ? null : (folderMap.get(cursor.parentId) ?? null);
  }
  return chain;
}

export function getFolderPathLabel(
  folder: DishwareInventoryFolderDto,
  folderMap: Map<number, DishwareInventoryFolderDto>,
) {
  return buildFolderChain(folder, folderMap)
    .map((item) => item.name)
    .join(" / ");
}

export function descendantIds(rootId: number, folders: DishwareInventoryFolderDto[]) {
  const children = new Map<number, number[]>();
  folders.forEach((folder) => {
    if (folder.parentId == null) return;
    children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder.id]);
  });

  const result = new Set<number>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

export function rootTrashedFolders(folders: DishwareInventoryFolderDto[]) {
  const trashedIds = new Set(folders.filter((folder) => folder.trashedAt).map((folder) => folder.id));
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  return folders.filter((folder) => {
    if (!folder.trashedAt) return false;
    let parent = folder.parentId == null ? null : (folderMap.get(folder.parentId) ?? null);
    const seen = new Set<number>();
    while (parent && !seen.has(parent.id)) {
      if (trashedIds.has(parent.id)) return false;
      seen.add(parent.id);
      parent = parent.parentId == null ? null : (folderMap.get(parent.parentId) ?? null);
    }
    return true;
  });
}
