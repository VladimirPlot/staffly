import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { EditableScheduleData, ScheduleRow, ShiftMode } from "../src/features/schedule/types.ts";

const { default: ScheduleTable } = await import("../src/features/schedule/components/ScheduleTable.tsx");
const { default: useScheduleCellEditing } = await import("../src/features/schedule/hooks/useScheduleCellEditing.ts");
const { canEditScheduleCell, scheduleRowCellKey, scheduleRowKey } = await import(
  "../src/features/schedule/utils/rowIdentity.ts"
);

const day = "2026-10-09";
const historical: ScheduleRow = {
  id: 12,
  memberId: 42,
  historical: true,
  displayName: "Старое имя",
  positionId: 1,
  positionName: "Старая должность",
};
const active: ScheduleRow = {
  id: 13,
  memberId: 43,
  displayName: "Новое имя",
  positionId: 2,
  positionName: "Новая должность",
};
const fixture = (rows: ScheduleRow[], shiftMode: ShiftMode = "FULL"): EditableScheduleData => ({
  id: 1,
  version: 1,
  status: "PUBLISHED",
  title: "График",
  config: { startDate: day, endDate: day, positionIds: [1, 2], showFullName: false, shiftMode },
  days: [{ date: day, weekdayLabel: "Пт", dayNumber: "09" }],
  rows,
  cellValues: Object.fromEntries(rows.map((row) => [scheduleRowCellKey(row, day), "08:00-14:00"])),
});
const render = (rows: ScheduleRow[], shiftMode: ShiftMode = "FULL", readOnly = false) =>
  renderToStaticMarkup(
    React.createElement(ScheduleTable, { data: fixture(rows, shiftMode), onChange: () => {}, readOnly }),
  );

test("published manager edit mode keeps historical cells read-only in every input mode", () => {
  for (const mode of ["FULL", "ARRIVAL_ONLY", "NONE"] as const) {
    const historyHtml = render([historical], mode);
    assert.doesNotMatch(historyHtml, /<(input|button|select)\b/);
    assert.match(historyHtml, /08:00/);
    assert.match(render([active], mode), mode === "NONE" ? /<input\b/ : /role="combobox"/);
    assert.doesNotMatch(render([active], mode, true), /<(input|button|select)\b/);
  }
});

test("history styling covers name, day and count while preserving snapshots and shift contrast", () => {
  const html = render([historical]);
  const historicalCells = html.match(/<div[^>]*data-historical="true"[^>]*>/g) ?? [];
  assert.equal(historicalCells.length, 3);
  historicalCells.forEach((cell) => assert.match(cell, /bg-app/));
  assert.match(historicalCells[0], /text-muted/);
  assert.match(html, />История<\/span>/);
  assert.match(html, /aria-label="История\. Историческая строка/);
  assert.match(html, /У сотрудника может быть отдельная активная строка/);
  assert.doesNotMatch(html, /сотрудник больше не участвует/);
  assert.match(html, /сохраняет прежние имя, должность и смены и доступна только для просмотра/);
  assert.match(html, /Старое имя/);
  assert.match(html, /Старая должность/);
  assert.match(html, /text-strong[^>]*><span>08:00<\/span>/);
  assert.doesNotMatch(html, /opacity-/);
  const activeHtml = render([active]);
  assert.doesNotMatch(activeHtml, /data-historical|История|Историческая строка/);
});

test("rehire and even same-member active/history rows retain separate identities and counts", () => {
  for (const operational of [
    active,
    { ...active, memberId: historical.memberId },
    { ...active, id: undefined, memberId: historical.id! },
  ]) {
    assert.notEqual(scheduleRowKey(historical), scheduleRowKey(operational));
    assert.notEqual(scheduleRowCellKey(historical, day), scheduleRowCellKey(operational, day));
    const html = render([historical, operational]);
    assert.match(html, /Старое имя/);
    assert.match(html, /Новое имя/);
    // Both row counts, the day total and the schedule total include preserved shifts.
    assert.deepEqual(
      [...html.matchAll(/>(\d+)<\/div>/g)].map((match) => Number(match[1])),
      [9, 1, 1, 2, 2],
    );
  }
  assert.equal(scheduleRowCellKey(historical, day), `-12:${day}`);
});

test("operational preference comments, hints and rejection diagnostics are suppressed on history", () => {
  const html = renderToStaticMarkup(
    React.createElement(ScheduleTable, {
      data: { ...fixture([historical]), cellValues: {} },
      onChange: () => {},
      readOnly: false,
      showCellDiagnostics: true,
      preferenceCommentsByMemberId: { 42: "Текущий комментарий" },
      preferenceHintsByCellKey: {
        [`-12:${day}`]: [
          {
            id: 1,
            day,
            type: "AVAILABLE",
            startTime: "08:00",
            endTime: "14:00",
            sortOrder: 0,
            note: "Текущее пожелание",
          },
        ],
      },
      rejectionHintsByCellKey: { [`-12:${day}`]: [{ message: "Текущий лимит" }] },
    }),
  );
  assert.doesNotMatch(html, /Текущий|Текущее|Лимит смен|Комментарий к|Применить пожелание/);
  assert.doesNotMatch(html, /<(button|input|select)\b/);
});

test("generic changeCell cannot mutate historical values, sources or structured shifts", () => {
  let state: EditableScheduleData | null = fixture([historical, active]);
  let changeCell: ReturnType<typeof useScheduleCellEditing>["changeCell"];
  function Harness() {
    ({ changeCell } = useScheduleCellEditing({
      onScheduleChanged: (update) => {
        state = typeof update === "function" ? update(state) : update;
      },
    }));
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
  const original = state;
  for (const options of [
    undefined,
    { commit: true, source: "MANUAL" as const },
    { commit: true, source: "PREFERENCE_HINT" as const },
  ]) {
    changeCell!(`-12:${day}`, "10:00-16:00", options);
    changeCell!(`42:${day}`, "10:00-16:00", options);
    assert.equal(state, original);
  }
  assert.equal(canEditScheduleCell(state!, `43:2026-10-10`), false);
  changeCell!(`43:${day}`, "10:00-16:00", { commit: true, source: "MANUAL" });
  assert.equal(state!.cellValues[`43:${day}`], "10:00-16:00");
  assert.equal(state!.cellSources![`43:${day}`], "MANUAL");
  assert.equal(state!.cellShifts![`43:${day}`].startTime, "10:00");
  assert.equal(state!.cellValues[`-12:${day}`], "08:00-14:00");
});
