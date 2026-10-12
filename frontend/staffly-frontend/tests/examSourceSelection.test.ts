import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countNestedQuestions,
  isCoveredByAllQuestions,
} from "../src/features/training/components/examEditor/sourceSelection.ts";
import type { ExamSourceFolderDto, QuestionBankTreeNodeDto } from "../src/features/training/api/types.ts";

const folders = new Map([
  [1, { id: 1, parentId: null, name: "Root", questionCount: 0 }],
  [2, { id: 2, parentId: 1, name: "Child", questionCount: 1 }],
  [3, { id: 3, parentId: 2, name: "Deep", questionCount: 2 }],
]);
const sources = (value: ExamSourceFolderDto) => new Map([[value.folderId, value]]);
test("direct parent selection leaves child questions selectable", () => {
  assert.equal(isCoveredByAllQuestions(2, folders, sources({ folderId: 1, pickMode: "ALL" })), false);
  assert.equal(isCoveredByAllQuestions(1, folders, sources({ folderId: 1, pickMode: "ALL" })), true);
});
test("recursive ALL marks questions covered at every depth", () => {
  assert.equal(
    isCoveredByAllQuestions(3, folders, sources({ folderId: 1, pickMode: "ALL", includeDescendants: true })),
    true,
  );
});
test("recursive RANDOM still permits selecting mandatory individual questions", () => {
  assert.equal(
    isCoveredByAllQuestions(
      3,
      folders,
      sources({ folderId: 1, pickMode: "RANDOM", randomCount: 1, includeDescendants: true }),
    ),
    false,
  );
});
test("counts include each descendant exactly once", () => {
  const node = (
    id: number,
    questionCount: number,
    children: QuestionBankTreeNodeDto[] = [],
  ): QuestionBankTreeNodeDto => ({
    id,
    parentId: null,
    name: String(id),
    active: true,
    sortOrder: 0,
    questionCount,
    children,
  });
  assert.equal(countNestedQuestions([node(2, 1, [node(3, 2)]), node(4, 4)]), 7);
});
