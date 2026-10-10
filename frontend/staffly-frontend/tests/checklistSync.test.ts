import assert from "node:assert/strict";
import test from "node:test";
import { mergeChecklistList, mergeChecklistUpdate } from "../src/features/checklists/utils/checklistSync.ts";

test("late mutation response cannot roll the checklist back", () => {
  const current = [{ id: 1, version: 4, done: true }];
  assert.deepEqual(mergeChecklistUpdate(current, { id: 1, version: 3, done: false }), current);
  assert.equal(mergeChecklistUpdate(current, { id: 1, version: 5, done: false })[0].done, false);
});
test("background refresh preserves newer mutations and refreshes equal-version URLs", () => {
  const current = [{ id: 1, version: 4, url: "old" }];
  assert.deepEqual(mergeChecklistList(current, [{ id: 1, version: 3, url: "stale" }]), current);
  assert.equal(mergeChecklistList(current, [{ id: 1, version: 4, url: "renewed" }])[0].url, "renewed");
});
test("responses cannot resurrect checklists removed from the current list", () => {
  assert.deepEqual(mergeChecklistUpdate([], { id: 1, version: 5 }), []);
  assert.deepEqual(mergeChecklistList([{ id: 1, version: 4 }], []), []);
});
