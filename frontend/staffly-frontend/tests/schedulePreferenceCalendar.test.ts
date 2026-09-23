import assert from "node:assert/strict";
import test from "node:test";

import {
  addDayDuringDrag,
  applyPreferenceDayEdit,
  applyPreferenceToSelectedDays,
  getCalendarLeadingSlotCount,
  getPreferenceCalendarPresentation,
  toggleSelectedDay,
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

test("selection toggles individual dates and drag adds each visited date once", () => {
  let selected = toggleSelectedDay(new Set(), "2026-09-21");
  selected = toggleSelectedDay(selected, "2026-09-23");
  selected = toggleSelectedDay(selected, "2026-09-21");
  assert.deepEqual([...selected], ["2026-09-23"]);

  const visited = new Set<string>();
  selected = addDayDuringDrag(selected, visited, "2026-09-24");
  const repeated = addDayDuringDrag(selected, visited, "2026-09-24");
  assert.deepEqual([...repeated], ["2026-09-23", "2026-09-24"]);
});

test("bulk edit replaces mixed selected states but preserves unselected dates", () => {
  const original = {
    "2026-09-21": day({ type: "UNAVAILABLE", note: "old" }),
    "2026-09-22": day({ type: "AVAILABLE", fullDay: false, startTime: "10:00", endTime: "17:00" }),
    "2026-09-23": day({ type: "PREFER_DAY_OFF" }),
  };
  const edit = day({ type: "AVAILABLE", note: "После учёбы" });
  const result = applyPreferenceToSelectedDays(original, new Set(["2026-09-21", "2026-09-22"]), edit);
  assert.deepEqual(result["2026-09-21"], edit);
  assert.deepEqual(result["2026-09-22"], edit);
  assert.strictEqual(result["2026-09-23"], original["2026-09-23"]);
  assert.equal(original["2026-09-21"].type, "UNAVAILABLE");
});

test("bulk AVAILABLE supports unrestricted and an authoritative shift option", () => {
  const original = { "2026-09-21": day({}), "2026-09-22": day({}) };
  const selected = new Set(Object.keys(original));
  const unrestricted = applyPreferenceToSelectedDays(original, selected, day({ type: "AVAILABLE" }));
  assert.ok(Object.values(unrestricted).every((value) => value.type === "AVAILABLE" && value.fullDay));

  const shifted = applyPreferenceToSelectedDays(
    original,
    selected,
    day({ type: "AVAILABLE", fullDay: false, startTime: "17:00", endTime: "00:00" }),
  );
  assert.ok(
    Object.values(shifted).every((value) => !value.fullDay && value.startTime === "17:00" && value.endTime === "00:00"),
  );
});

test("bulk non-AVAILABLE types enforce sparse and interval-free semantics", () => {
  const original = { "2026-09-21": day({ type: "AVAILABLE" }) };
  const selected = new Set(["2026-09-21"]);
  for (const type of ["UNAVAILABLE", "PREFER_DAY_OFF"] as const) {
    const result = applyPreferenceToSelectedDays(
      original,
      selected,
      day({ type, fullDay: false, startTime: "10:00", endTime: "17:00", note: "reason" }),
    );
    assert.deepEqual(result["2026-09-21"], {
      type,
      fullDay: true,
      startTime: "",
      endTime: "",
      note: "reason",
    });
  }
  const cleared = applyPreferenceToSelectedDays(
    original,
    selected,
    day({ type: "NO_PREFERENCE", fullDay: false, startTime: "10:00", endTime: "17:00", note: "discard" }),
  );
  assert.deepEqual(cleared["2026-09-21"], day({}));
});
