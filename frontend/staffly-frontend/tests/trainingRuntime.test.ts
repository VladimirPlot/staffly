import assert from "node:assert/strict";
import test from "node:test";
import "./registerTsx.ts";
import type { ExamAttemptDto } from "../src/features/training/api/types.ts";
const { restoreExamRun } = await import("../src/features/training/pages/examRun/resumeState.ts");
const { readPersistedExamRunState, writePersistedExamRunState, removePersistedExamRunState } = await import("../src/features/training/pages/examRun/storage.ts");

const response = {
  attemptId: 10,
  questions: [{ questionId: 1 }, { questionId: 2 }, { questionId: 3 }],
  savedAnswers: [{ questionId: 1, answerJson: '"server"' }],
} as ExamAttemptDto;

test("resuming on another device restores server confirmations and opens the next question", () => {
  assert.deepEqual(restoreExamRun(response, null), {
    answers: { 1: '"server"' }, confirmedQuestionIds: [1], currentIndex: 1,
  });
});

test("server answers override drafts and local confirmation does not masquerade as a saved answer", () => {
  const restored = restoreExamRun(response, {
    attemptId: 10, answers: { 1: '"local"', 2: '"draft"' }, confirmedQuestionIds: [1, 2], currentIndex: 2,
  });
  assert.deepEqual(restored.answers, { 1: '"server"', 2: '"draft"' });
  assert.deepEqual(restored.confirmedQuestionIds, [1]);
  assert.equal(restored.currentIndex, 1);
});

test("previous attempts cannot contaminate the next attempt", () => {
  const restored = restoreExamRun(response, {
    attemptId: 9, answers: { 2: '"old"' }, confirmedQuestionIds: [2], currentIndex: 99,
  });
  assert.deepEqual(restored.answers, { 1: '"server"' });
  assert.equal(restored.currentIndex, 1);
});

test("fully confirmed attempt opens its final question so it can be completed", () => {
  const restored = restoreExamRun({ ...response, savedAnswers: [1, 2, 3].map((questionId) => ({ questionId, answerJson: '"yes"' })) }, null);
  assert.equal(restored.currentIndex, 2);
  assert.deepEqual(restored.confirmedQuestionIds, [1, 2, 3]);
});

test("blocked draft storage does not prevent server-backed exam execution", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try {
    assert.equal(readPersistedExamRunState(1), null);
    assert.doesNotThrow(() => writePersistedExamRunState(1, { attemptId: 10, answers: {}, currentIndex: 0, confirmedQuestionIds: [] }));
    assert.doesNotThrow(() => removePersistedExamRunState(1));
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
