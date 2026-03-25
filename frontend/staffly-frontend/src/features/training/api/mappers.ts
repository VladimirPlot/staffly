import type { TrainingExamDto, TrainingFolderDto, TrainingKnowledgeItemDto } from "./types";
import { bySortOrderAndName } from "../utils/sort";

export function mapFoldersForUi(folders: TrainingFolderDto[]): TrainingFolderDto[] {
  return [...folders].sort(bySortOrderAndName);
}

export function mapKnowledgeItemsForUi(items: TrainingKnowledgeItemDto[]): TrainingKnowledgeItemDto[] {
  return [...items].sort(bySortOrderAndName);
}

export function mapExamsForUi(exams: TrainingExamDto[]): TrainingExamDto[] {
  return [...exams].sort(bySortOrderAndName);
}
