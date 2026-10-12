import type { ExamSourceFolderDto, QuestionBankTreeNodeDto } from "../../api/types";
import type { FlatTreeNode } from "./types";

export function countNestedQuestions(nodes: QuestionBankTreeNodeDto[]): number {
  return nodes.reduce((total, node) => total + node.questionCount + countNestedQuestions(node.children), 0);
}

export function isCoveredByAllQuestions(
  folderId: number | null,
  folders: Map<number, FlatTreeNode>,
  sources: Map<number, ExamSourceFolderDto>,
): boolean {
  let current = folderId == null ? undefined : folders.get(folderId);
  const visited = new Set<number>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const source = sources.get(current.id);
    if (source?.pickMode === "ALL" && (current.id === folderId || source.includeDescendants)) return true;
    current = current.parentId == null ? undefined : folders.get(current.parentId);
  }
  return false;
}
