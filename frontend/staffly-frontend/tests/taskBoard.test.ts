import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import {
  restaurantToday,
  formatTaskInstant,
  diffTaskDays,
  inTaskPeriod,
  isTaskOverdue,
  nearestTaskPeriod,
} from "../src/features/tasks/utils.ts";
import type { TaskDto } from "../src/features/tasks/api.ts";
const { default: BoardTaskCard } = await import("../src/features/tasks/components/BoardTaskCard.tsx");
const task = {
  id: 1,
  title: "Инструкция",
  status: "ACTIVE",
  priority: "HIGH",
  dueDate: "2026-10-10",
  completionMode: "EACH",
  audience: "POSITIONS",
  participants: [{ memberId: 1, userId: 1, name: "Иван", active: true, completedAt: null }],
  participantCount: 3,
  completedCount: 1,
  myCompleted: false,
  canComplete: true,
  timezone: "Europe/Moscow",
  setter: { fullName: "Мария" },
} as TaskDto;
test("initial period finds the nearest open task including overdue work", () => {
  const today = "2026-10-10";
  assert.equal(nearestTaskPeriod([task], today), "TODAY");
  assert.equal(nearestTaskPeriod([{ ...task, dueDate: "2026-10-08" }], today), "TODAY");
  assert.equal(nearestTaskPeriod([{ ...task, dueDate: "2026-10-13" }], today), "WEEK");
  assert.equal(nearestTaskPeriod([{ ...task, dueDate: "2026-10-17" }], today), "ALL");
  assert.equal(nearestTaskPeriod([], today), "ALL");
});
test("completed history does not hide upcoming open tasks during initial period selection", () => {
  const done = { ...task, status: "COMPLETED", completedAt: "2026-10-10T08:00:00Z" } as TaskDto;
  assert.equal(nearestTaskPeriod([done, { ...task, dueDate: "2026-10-12" }], "2026-10-10"), "WEEK");
  assert.equal(nearestTaskPeriod([{ ...task, myCompleted: true }], "2026-10-10"), "TODAY");
});
test("restaurant date and completion time do not follow the device zone", () => {
  const now = new Date("2026-10-09T21:30:00Z");
  assert.equal(restaurantToday("Europe/Moscow", now), "2026-10-10");
  assert.equal(restaurantToday("America/New_York", now), "2026-10-09");
  assert.match(formatTaskInstant(now.toISOString(), "Europe/Moscow"), /00:30/);
  assert.equal(diffTaskDays("2026-10-10", "2026-10-10"), 0);
});
test("today and week keep overdue work visible and exclude distant deadlines", () => {
  assert.equal(inTaskPeriod({ ...task, dueDate: "2026-10-08" }, "TODAY", "2026-10-10"), true);
  assert.equal(inTaskPeriod({ ...task, dueDate: "2026-10-11" }, "TODAY", "2026-10-10"), false);
  assert.equal(inTaskPeriod({ ...task, dueDate: "2026-10-16" }, "WEEK", "2026-10-10"), true);
  assert.equal(inTaskPeriod({ ...task, dueDate: "2026-10-17" }, "WEEK", "2026-10-10"), false);
});
test("completed periods use completion date rather than original deadline", () => {
  const done = { ...task, status: "COMPLETED", dueDate: "2026-10-01", completedAt: "2026-10-09T21:30:00Z" } as TaskDto;
  assert.equal(inTaskPeriod(done, "TODAY", "2026-10-10"), true);
  assert.equal(inTaskPeriod(done, "TODAY", "2026-10-11"), false);
});
const render = (t: TaskDto) =>
  renderToStaticMarkup(
    React.createElement(BoardTaskCard, {
      task: t,
      today: "2026-10-10",
      layout: "grid",
      busy: false,
      onOpen: () => {},
      onComplete: () => {},
    }),
  );
test("individual result shows progress and does not offer a second completion", () => {
  assert.match(render(task), /1 \/ 3/);
  assert.match(render(task), /Я выполнил/);
  const html = render({ ...task, myCompleted: true });
  assert.match(html, /Ваш результат сохранён/);
  assert.doesNotMatch(html, /Я выполнил/);
});
test("completed card never labels a historical deadline as overdue", () => {
  const html = render({ ...task, status: "COMPLETED", dueDate: "2026-10-01", completedAt: "2026-10-10T08:00:00Z" });
  assert.doesNotMatch(html, /просрочено/);
  assert.match(html, /Выполнено/);
  assert.doesNotMatch(html, /Мария|Владелец:/);
});

test("manager outside the audience sees progress without a misleading completion rule", () => {
  const html = render({ ...task, canComplete: false });
  assert.match(html, /1 \/ 3/);
  assert.doesNotMatch(html, /Достаточно одного исполнителя|Владелец:/);
  assert.doesNotMatch(render({ ...task, completionMode: "ANY", canComplete: false }), /Достаточно одного исполнителя/);
});

test("timed deadlines become overdue at the restaurant's local time", () => {
  const timed = { ...task, dueTime: "12:15" };
  assert.equal(isTaskOverdue(timed, new Date("2026-10-10T09:14:59Z")), false);
  assert.equal(isTaskOverdue(timed, new Date("2026-10-10T09:15:00Z")), true);
  assert.equal(isTaskOverdue({ ...task, dueTime: null }, new Date("2026-10-10T20:59:59Z")), false);
  assert.equal(isTaskOverdue({ ...task, dueTime: null }, new Date("2026-10-10T21:00:00Z")), true);
  assert.equal(isTaskOverdue({ ...timed, status: "COMPLETED" }, new Date("2026-10-11T10:00:00Z")), false);
});
