import assert from "node:assert/strict";
import test from "node:test";

import type { SchedulePreferenceMyResponse } from "../src/features/schedule/api.ts";
import {
  buildPreferenceCellsRequest,
  buildSchedulePreferenceDraftKey,
  canAutosaveSchedulePreferenceDraft,
  readSchedulePreferenceDraft,
  removeSchedulePreferenceDraft,
  resolveSchedulePreferenceDraft,
  writeSchedulePreferenceDraft,
  type SchedulePreferenceDraft,
  type SchedulePreferenceDraftIdentity,
} from "../src/features/schedule/schedulePreferenceDraftStorage.ts";
import { completeOwnSchedulePreferenceSubmit } from "../src/features/schedule/schedulePreferenceSubmitTransition.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const identity: SchedulePreferenceDraftIdentity = {
  restaurantId: 1,
  memberId: 10,
  scheduleId: 100,
  preferenceCollectionCycle: 4,
};
const draft: SchedulePreferenceDraft = {
  schemaVersion: 1,
  baseRevision: 3,
  savedAt: "2026-09-23T00:00:00.000Z",
  cellsByDay: {
    "2026-10-01": { type: "NO_PREFERENCE", fullDay: true, startTime: "", endTime: "", note: "remember" },
  },
  periodComment: "period note",
};

function response(revision = 3, canSubmit = true): SchedulePreferenceMyResponse {
  return {
    scheduleId: 100,
    title: "October",
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    days: [{ date: "2026-10-01", weekdayLabel: "Thu" }],
    status: "COLLECTING_PREFERENCES",
    preferenceCollectionMode: "DAY_LEVEL",
    canSubmit,
    revision,
    preferenceCollectionCycle: 4,
    member: { memberId: 10 },
    allowedShiftOptionsByDate: {},
    cells: [],
    periodComment: null,
  };
}

test("saves and reads a validated draft", () => {
  const storage = new MemoryStorage();
  assert.equal(writeSchedulePreferenceDraft(identity, draft, storage), true);
  assert.deepEqual(readSchedulePreferenceDraft(identity, storage), draft);
});

test("storage identity isolates restaurant, member, schedule, and cycle", () => {
  const variants = ["restaurantId", "memberId", "scheduleId", "preferenceCollectionCycle"] as const;
  for (const field of variants) {
    assert.notEqual(
      buildSchedulePreferenceDraftKey(identity),
      buildSchedulePreferenceDraftKey({ ...identity, [field]: 999 }),
    );
  }
});

test("uses authoritative state when there is no draft", () => {
  const resolved = resolveSchedulePreferenceDraft(response(7), null);
  assert.equal(resolved.reason, "NO_DRAFT");
  assert.equal(resolved.baseRevision, 7);
  assert.equal(resolved.editableState.periodComment, "");
  assert.equal(resolved.editableState.cellsByDay["2026-10-01"]?.type, "NO_PREFERENCE");
});

test("restores a draft based on the current revision", () => {
  const resolved = resolveSchedulePreferenceDraft(response(3), draft);
  assert.equal(resolved.reason, "RESTORED");
  assert.equal(resolved.baseRevision, draft.baseRevision);
  assert.deepEqual(resolved.editableState, {
    cellsByDay: draft.cellsByDay,
    periodComment: draft.periodComment,
  });
});

test("uses authoritative state for a revision mismatch", () => {
  const storage = new MemoryStorage();
  writeSchedulePreferenceDraft(identity, draft, storage);
  const stale = resolveSchedulePreferenceDraft(response(4), readSchedulePreferenceDraft(identity, storage));
  assert.equal(stale.reason, "REVISION_MISMATCH");
  assert.equal(stale.baseRevision, 4);
  assert.equal(stale.editableState.periodComment, "");
  assert.equal(stale.editableState.cellsByDay["2026-10-01"]?.type, "NO_PREFERENCE");
  if (stale.reason === "REVISION_MISMATCH") removeSchedulePreferenceDraft(identity, storage);
  assert.equal(readSchedulePreferenceDraft(identity, storage), null);
});

test("corrupted JSON and unknown schema versions are discarded", () => {
  const storage = new MemoryStorage();
  const key = buildSchedulePreferenceDraftKey(identity);
  storage.setItem(key, "{bad json");
  assert.equal(readSchedulePreferenceDraft(identity, storage), null);
  assert.equal(storage.getItem(key), null);
  storage.setItem(key, JSON.stringify({ ...draft, schemaVersion: 2 }));
  assert.equal(readSchedulePreferenceDraft(identity, storage), null);
  assert.equal(storage.getItem(key), null);
});

test("closed collection rejects and discards a draft", () => {
  const resolved = resolveSchedulePreferenceDraft(response(3, false), draft);
  assert.equal(resolved.reason, "COLLECTION_CLOSED");
  assert.equal(resolved.baseRevision, 3);
  assert.equal(resolved.editableState.periodComment, "");
  assert.equal(resolved.editableState.cellsByDay["2026-10-01"]?.type, "NO_PREFERENCE");
});

test("autosave is blocked before hydration and after successful-submit cleanup", () => {
  assert.equal(canAutosaveSchedulePreferenceDraft(false, true, identity, 3), false);
  assert.equal(canAutosaveSchedulePreferenceDraft(true, false, identity, 3), false);
  assert.equal(canAutosaveSchedulePreferenceDraft(true, true, identity, 3), true);
});

test("successful-submit cleanup removes the draft while failed flow can preserve it", () => {
  const storage = new MemoryStorage();
  writeSchedulePreferenceDraft(identity, draft, storage);
  // A failed submit performs no cleanup.
  assert.deepEqual(readSchedulePreferenceDraft(identity, storage), draft);
  removeSchedulePreferenceDraft(identity, storage);
  assert.equal(readSchedulePreferenceDraft(identity, storage), null);
});

test("own successful submit removes its draft before publishing the successor revision", () => {
  const storage = new MemoryStorage();
  writeSchedulePreferenceDraft(identity, draft, storage);
  const successor = response(4);
  const transitions: string[] = [];

  const published = completeOwnSchedulePreferenceSubmit(
    successor,
    () => {
      transitions.push("cleanup");
      removeSchedulePreferenceDraft(identity, storage);
    },
    () => true,
    (authoritative) => {
      transitions.push("publish");
      const resolved = resolveSchedulePreferenceDraft(authoritative, readSchedulePreferenceDraft(identity, storage));
      assert.equal(resolved.reason, "NO_DRAFT");
    },
  );

  assert.equal(published, true);
  assert.deepEqual(transitions, ["cleanup", "publish"]);
  assert.equal(readSchedulePreferenceDraft(identity, storage), null);
});

test("own successful submit cleans its draft even when navigation suppresses publication", () => {
  const storage = new MemoryStorage();
  writeSchedulePreferenceDraft(identity, draft, storage);
  let published = false;

  const current = completeOwnSchedulePreferenceSubmit(
    response(4),
    () => removeSchedulePreferenceDraft(identity, storage),
    () => false,
    () => {
      published = true;
    },
  );

  assert.equal(current, false);
  assert.equal(published, false);
  assert.equal(readSchedulePreferenceDraft(identity, storage), null);
});

test("NO_PREFERENCE stays local while unrestricted AVAILABLE remains explicit", () => {
  const cells = buildPreferenceCellsRequest(
    [
      { date: "2026-10-01", weekdayLabel: "Thu" },
      { date: "2026-10-02", weekdayLabel: "Fri" },
    ],
    {
      "2026-10-01": draft.cellsByDay["2026-10-01"]!,
      "2026-10-02": { type: "AVAILABLE", fullDay: true, startTime: "", endTime: "", note: "available note" },
    },
  );
  assert.deepEqual(cells, [
    {
      day: "2026-10-02",
      type: "AVAILABLE",
      fullDay: true,
      startTime: null,
      endTime: null,
      note: "available note",
    },
  ]);
});
