import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { CommonSchedule } from "../src/features/commonSchedule/api.ts";

const { commonScheduleTodaySources, fitsCommonSchedulePeriod, sortCommonScheduleCandidates } = await import(
  "../src/features/commonSchedule/utils.ts"
);

const { default: CommonScheduleView } = await import(
  "../src/features/commonSchedule/components/CommonScheduleView.tsx"
);

test("common schedule requires full containment and accepts matching boundaries", () => {
  const primary = { startDate: "2026-10-01", endDate: "2026-10-31" };
  assert.equal(fitsCommonSchedulePeriod(primary, primary), true);
  assert.equal(fitsCommonSchedulePeriod(primary, { startDate: "2026-10-05", endDate: "2026-10-20" }), true);
  assert.equal(fitsCommonSchedulePeriod(primary, { startDate: "2026-09-30", endDate: "2026-10-10" }), false);
  assert.equal(fitsCommonSchedulePeriod(primary, { startDate: "2026-10-20", endDate: "2026-11-01" }), false);
});

test("candidates sort by period end descending then Russian title without mutating inputs", () => {
  const items = [
    { id: 1, title: "Я", startDate: "2026-10-01", endDate: "2026-10-31" },
    { id: 2, title: "А", startDate: "2026-09-01", endDate: "2026-09-30" },
    { id: 3, title: "Бар", startDate: "2026-10-01", endDate: "2026-10-31" },
  ];
  assert.deepEqual(
    sortCommonScheduleCandidates(items).map((s) => s.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    items.map((s) => s.id),
    [1, 2, 3],
  );
});

test("today combines source shifts, uses historical identities and excludes dates outside each source", () => {
  const content = {
    config: {
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      shiftMode: "FULL" as const,
      showFullName: true,
      positionIds: [1],
    },
    days: [],
    rows: [
      { id: 100, memberId: 42, displayName: "Анна", positionId: 1, positionName: "Бармен" },
      { id: 101, memberId: 42, historical: true, displayName: "Анна", positionId: 2, positionName: "Официант" },
      { id: 102, memberId: 43, displayName: "Иван", positionId: 1, positionName: "Бармен" },
    ],
    cellValues: { "42:2026-10-12": "09:00-17:00", "-101:2026-10-12": "10:00-18:00", "43:2026-10-12": "  " },
  };
  const sources = [
    { id: 10, version: 1, title: "Бар", content },
    {
      id: 20,
      version: 1,
      title: "Зал",
      content: { ...content, config: { ...content.config, startDate: "2026-10-16" } },
    },
  ];
  const today = commonScheduleTodaySources(sources, "2026-10-12");
  assert.deepEqual(
    today[0].rows.map((row) => row.id),
    [100, 101],
  );
  assert.equal(today[1].rows.length, 0);
  assert.equal(
    commonScheduleTodaySources(sources, "2026-11-01").every((source) => source.rows.length === 0),
    true,
  );
});

test("common table keeps overlapping employees in source blocks and history separate, without editing", () => {
  const schedule: CommonSchedule = {
    summary: {
      id: 1,
      version: 1,
      title: "Общий",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      scheduleIds: [10, 20],
      visibleToPositions: false,
    },
    sources: [
      {
        id: 10,
        version: 1,
        title: "Бар",
        content: {
          config: {
            startDate: "2026-10-01",
            endDate: "2026-10-03",
            shiftMode: "FULL",
            showFullName: true,
            positionIds: [1],
          },
          days: [],
          rows: [{ id: 100, memberId: 42, displayName: "Анна", positionId: 1, positionName: "Бармен" }],
          cellValues: { "42:2026-10-01": "09:00-17:00" },
        },
      },
      {
        id: 20,
        version: 1,
        title: "Зал",
        content: {
          config: {
            startDate: "2026-10-02",
            endDate: "2026-10-03",
            shiftMode: "FULL",
            showFullName: true,
            positionIds: [2],
          },
          days: [],
          rows: [
            { id: 101, memberId: 42, historical: true, displayName: "Анна", positionId: 2, positionName: "Официант" },
          ],
          cellValues: { "-101:2026-10-02": "10:00-18:00", "42:2026-10-02": "WRONG" },
        },
      },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(CommonScheduleView, {
      schedule,
      timeZone: "Europe/Moscow",
      canManage: false,
      refreshing: false,
      onBack() {},
      onRefresh() {},
      onEdit() {},
    }),
  );
  assert.match(html, /Бармен/);
  assert.match(html, /Официант/);
  assert.match(html, /09:00/);
  assert.match(html, /10:00/);
  assert.match(html, /Вне периода графика/);
  assert.match(html, /Смена сегодня/);
  assert.doesNotMatch(html, /WRONG|<input(?![^>]*type="range")|contenteditable|Заявки|Настройки/);
  assert.match(html, /type="range" min="10" max="120"/);
  assert.equal((html.match(/>Анна</g) ?? []).length, 2);
});
