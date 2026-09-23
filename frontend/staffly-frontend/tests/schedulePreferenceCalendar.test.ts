import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPreferenceDayEdit,
  getCalendarLeadingSlotCount,
  getPreferenceCalendarPresentation,
} from "../src/features/schedule/schedulePreferenceCalendar.ts";
import type { PreferenceDayDraft } from "../src/features/schedule/schedulePreferenceDraftStorage.ts";

const day = (overrides: Partial<PreferenceDayDraft>): PreferenceDayDraft => ({
  type: "NO_PREFERENCE",
  fullDay: true,
  startTime: "",
  endTime: "",
  note: "",
  ...overrides,
});

test("presents every preference state compactly", () => {
  assert.deepEqual(getPreferenceCalendarPresentation(day({ type: "NO_PREFERENCE" })), {
    label: "Без пожеланий",
    tone: "green",
  });
  assert.deepEqual(getPreferenceCalendarPresentation(day({ type: "AVAILABLE" })), {
    label: "Весь день",
    tone: "green",
  });
  assert.deepEqual(
    getPreferenceCalendarPresentation(day({ type: "AVAILABLE", fullDay: false, startTime: "17:00", endTime: "00:00" })),
    { label: "Могу", tone: "green", startTime: "17:00", endTime: "00:00" },
  );
  assert.deepEqual(getPreferenceCalendarPresentation(day({ type: "PREFER_DAY_OFF" })), {
    label: "Выходной",
    tone: "amber",
  });
  assert.deepEqual(getPreferenceCalendarPresentation(day({ type: "UNAVAILABLE" })), {
    label: "Не могу",
    tone: "red",
  });
});

test("positions a period beginning away from Monday", () => {
  assert.equal(getCalendarLeadingSlotCount("2026-09-23"), 2);
  assert.equal(getCalendarLeadingSlotCount("2026-09-21"), 0);
});

test("applying an editor draft replaces only the selected day", () => {
  const original = { "2026-09-23": day({}), "2026-09-24": day({ type: "UNAVAILABLE" }) };
  const edit = day({ type: "AVAILABLE", note: "После учёбы" });
  const result = applyPreferenceDayEdit(original, "2026-09-23", edit);
  assert.deepEqual(result["2026-09-23"], edit);
  assert.strictEqual(result["2026-09-24"], original["2026-09-24"]);
  assert.notStrictEqual(result, original);
});

test("an untouched editor copy cannot mutate editable state", () => {
  const original = day({ type: "UNAVAILABLE", note: "Экзамен" });
  const editorCopy = { ...original };
  editorCopy.note = "Отменено";
  assert.equal(original.note, "Экзамен");
});
