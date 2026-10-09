import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { TaskDto } from "../src/features/tasks/api.ts";
const { isUnassignedTask, resolveTaskAssignee } = await import("../src/features/tasks/utils.ts");
const { default: TaskCard } = await import("../src/features/tasks/components/TaskCard.tsx");

const orphan: TaskDto = {
  id: 1,
  version: 4,
  restaurantId: 1,
  title: "Orphan",
  priority: "LOW",
  status: "ACTIVE",
  assignedToAll: false,
};
const assigned = { ...orphan, assignedUser: { id: 8, fullName: "Сотрудник" } };
const variants: TaskDto[] = [
  assigned,
  { ...orphan, assignedToAll: true },
  { ...orphan, assignedPosition: { id: 2, name: "Должность" } },
  { ...orphan, status: "COMPLETED" },
];

test("orphan filter includes only active tasks with no assignment scope", () => {
  assert.equal(isUnassignedTask(orphan), true);
  assert.equal(resolveTaskAssignee(orphan), "Без исполнителя");
  variants.forEach((task) => assert.equal(isUnassignedTask(task), false));
  assert.deepEqual([orphan, ...variants].filter(isUnassignedTask), [orphan]);
});

const render = (task: TaskDto, manager: boolean) =>
  renderToStaticMarkup(
    React.createElement(TaskCard, {
      task,
      onOpen: () => {},
      onComplete: () => {},
      onDelete: () => {},
      canDelete: manager,
      onAssign: manager ? () => {} : undefined,
    }),
  );

test("assignment action is visible only for managers on active orphan cards", () => {
  assert.match(render(orphan, true), />Назначить<\/button>/);
  assert.doesNotMatch(render(orphan, false), />Назначить<\/button>/);
  variants.forEach((task) => assert.doesNotMatch(render(task, true), />Назначить<\/button>/));
});
