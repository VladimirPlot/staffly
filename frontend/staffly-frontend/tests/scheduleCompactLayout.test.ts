import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { ScheduleData } from "../src/features/schedule/types.ts";

const { default: Shift } = await import("../src/features/commonSchedule/components/CommonScheduleShift.tsx");
const { default: ScheduleTable } = await import("../src/features/schedule/components/ScheduleTable.tsx");

test("full shifts have start, separator and end on separate lines, including overnight ranges", () => {
  for (const value of ["09:00-17:00", "22:00-06:00", "08:00-24:00"]) {
    const html = renderToStaticMarkup(React.createElement(Shift, { value, mode: "FULL" }));
    assert.match(html, /flex-col/);
    assert.match(html, /aria-label="/);
    assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 3);
    assert.match(html, /aria-hidden="true">-<\/span>/);
  }
});

test("compact cells preserve arrival-only times, empty values and free-text markers", () => {
  assert.equal(renderToStaticMarkup(React.createElement(Shift, { value: "", mode: "FULL" })), "<span></span>");
  assert.match(renderToStaticMarkup(React.createElement(Shift, { value: "09:00", mode: "ARRIVAL_ONLY" })), />09:00</);
  assert.match(renderToStaticMarkup(React.createElement(Shift, { value: "В", mode: "FULL" })), />В</);
  assert.doesNotMatch(
    renderToStaticMarkup(React.createElement(Shift, { value: "09:00-17:00", mode: "NONE" })),
    /flex-col/,
  );
});

test("ordinary schedules at 10 percent scale CSS minimum dimensions in viewing and editing modes", () => {
  const data: ScheduleData = {
    id: 1,
    version: 1,
    title: "Месяц",
    config: { startDate: "2026-10-01", endDate: "2026-10-30", positionIds: [1], showFullName: true, shiftMode: "FULL" },
    rows: [],
    cellValues: {},
    days: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      dayNumber: String(i + 1),
      weekdayLabel: "пн",
    })),
  };
  for (const readOnly of [true, false]) {
    const html = renderToStaticMarkup(
      React.createElement(ScheduleTable, { data, readOnly, onChange() {}, zoomScale: 0.1 }),
    );
    assert.match(html, /data-schedule-table-zoom="10"/);
    assert.match(html, readOnly ? /zoom:0\.2/ : /zoom:0\.1538/);
  }
});
