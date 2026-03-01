import type { TrainingFolderDto } from "../api/types";
import { trainingRoutes } from "./trainingRoutes";

type ExamOrigin = "knowledge" | "exams";

export function buildExamRunBreadcrumbs(origin: ExamOrigin, folderId: number | null, folders: TrainingFolderDto[]) {
  if (origin === "exams") {
    return [
      { label: "Тренинг", to: trainingRoutes.landing },
      { label: "Аттестации", to: trainingRoutes.exams },
      { label: "Прохождение" },
    ];
  }

  const crumbs: { label: string; to?: string }[] = [
    { label: "Тренинг", to: trainingRoutes.landing },
    { label: "База знаний", to: trainingRoutes.knowledge },
  ];

  if (folderId != null) {
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
    const chain: TrainingFolderDto[] = [];
    const seen = new Set<number>();
    let cursor = folderMap.get(folderId) ?? null;
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
  }

  crumbs.push({ label: "Прохождение" });
  return crumbs;
}
