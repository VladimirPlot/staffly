import type { PositionDto } from "../../../dictionaries/api";
import type { ExamSourceFolderDto, QuestionBankTreeNodeDto } from "../../api/types";
import type { FlatTreeNode } from "./types";
import type { TrainingExamMode } from "../../api/types";

export function flattenTree(
  nodes: QuestionBankTreeNodeDto[],
  parentId: number | null = null,
): FlatTreeNode[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      questionCount: node.questionCount,
      parentId,
    },
    ...flattenTree(node.children, node.id),
  ]);
}

export function createTreeHelpers(flatTree: FlatTreeNode[]) {
  const folderMetaMap = new Map(flatTree.map((node) => [node.id, node]));
  const childrenByParentId = new Map<number, number[]>();

  flatTree.forEach((node) => {
    if (node.parentId == null) return;
    const current = childrenByParentId.get(node.parentId) ?? [];
    current.push(node.id);
    childrenByParentId.set(node.parentId, current);
  });

  const getAncestorIds = (folderId: number) => {
    const ids: number[] = [];
    let cursor = folderMetaMap.get(folderId) ?? null;
    while (cursor?.parentId != null) {
      ids.push(cursor.parentId);
      cursor = folderMetaMap.get(cursor.parentId) ?? null;
    }
    return ids;
  };

  const getDescendantIds = (folderId: number) => {
    const result: number[] = [];
    const stack = [...(childrenByParentId.get(folderId) ?? [])];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current == null) continue;
      result.push(current);
      stack.push(...(childrenByParentId.get(current) ?? []));
    }

    return result;
  };

  return { folderMetaMap, getAncestorIds, getDescendantIds };
}

export function calculateTotalQuestions(
  sourcesFolders: ExamSourceFolderDto[],
  sourceQuestionIds: number[],
  folderMetaMap: Map<number, FlatTreeNode>,
) {
  const foldersCount = sourcesFolders.reduce((sum, source) => {
    const folder = folderMetaMap.get(source.folderId);
    if (!folder) return sum;

    if (source.pickMode === "RANDOM") {
      const requested = Math.max(0, Number(source.randomCount ?? 0));
      return sum + Math.min(requested, folder.questionCount);
    }

    return sum + folder.questionCount;
  }, 0);

  return foldersCount + sourceQuestionIds.length;
}

export function buildAvailabilityLabel(
  mode: TrainingExamMode,
  visibilityPositionIds: number[],
  positions: PositionDto[],
  isDesktop: boolean,
) {
  if (visibilityPositionIds.length === 0) return "Всем сотрудникам";
  if (
    mode === "CERTIFICATION"
    && positions.length > 0
    && visibilityPositionIds.length === positions.length
  ) {
    return "Всем сотрудникам";
  }

  const selected = positions.filter((position) => visibilityPositionIds.includes(position.id));
  if (selected.length === 0) return "Всем сотрудникам";

  const visibleCount = isDesktop ? 4 : 2;
  if (selected.length <= visibleCount) {
    return selected.map((position) => position.name).join(", ");
  }

  const visibleNames = selected
    .slice(0, visibleCount)
    .map((position) => position.name)
    .join(", ");
  return `${visibleNames} +${selected.length - visibleCount}`;
}
