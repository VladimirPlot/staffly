import { useMemo } from "react";
import type { TrainingFolderDto } from "../../api/types";
import { trainingRoutes } from "../../utils/trainingRoutes";

export function useKnowledgeBreadcrumbs(
  currentFolder: TrainingFolderDto | null,
  folderMap: Map<number, TrainingFolderDto>,
) {
  return useMemo(() => {
    const crumbs: { label: string; to?: string }[] = [
      { label: "Тренинг", to: trainingRoutes.landing },
      { label: "База знаний", to: trainingRoutes.knowledge },
    ];
    if (!currentFolder) return crumbs;

    const chain: TrainingFolderDto[] = [];
    const seen = new Set<number>();
    let cursor: TrainingFolderDto | null = currentFolder;
    while (cursor && !seen.has(cursor.id)) {
      chain.unshift(cursor);
      seen.add(cursor.id);
      cursor = cursor.parentId ? folderMap.get(cursor.parentId) ?? null : null;
    }

    chain.forEach((folder, index) => {
      const isLast = index === chain.length - 1;
      crumbs.push({
        label: folder.name,
        to: isLast ? undefined : `${trainingRoutes.knowledge}/${folder.id}`,
      });
    });

    return crumbs;
  }, [currentFolder, folderMap]);
}
