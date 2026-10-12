import type { TrainingFolderDto } from "../api/types";

/** Resolve the full path and the first ancestor that must be restored, without changing visibility. */
export function trainingArchiveContext(parentId: number | null, folders: TrainingFolderDto[], rootLabel: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestors: TrainingFolderDto[] = [];
  const visited = new Set<number>();
  let id = parentId;
  let incomplete = false;
  while (id != null) {
    const folder = byId.get(id);
    if (!folder || visited.has(id)) {
      incomplete = true;
      break;
    }
    visited.add(id);
    ancestors.unshift(folder);
    id = folder.parentId;
  }
  const hiddenParent = ancestors.find((folder) => !folder.active);
  return {
    path: [rootLabel, ...(incomplete ? ["Недоступная папка"] : []), ...ancestors.map((folder) => folder.name)].join(
      " / ",
    ),
    restoreDisabledReason: incomplete
      ? "Родительская папка недоступна. Обновите архив или проверьте доступ к ней."
      : hiddenParent
        ? `Сначала восстановите папку «${hiddenParent.name}».`
        : undefined,
  };
}
