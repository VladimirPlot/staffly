import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { ReminderRequest } from "../src/features/reminders/api.ts";
import type { ReminderDialogInitial } from "../src/features/reminders/components/ReminderDialog.tsx";

const { default: ReminderDialog } = await import("../src/features/reminders/components/ReminderDialog.tsx");
const { isDetachedReminder } = await import("../src/features/reminders/reminderTarget.ts");

const positions = [
  { id: 11, name: "Официант", active: true, level: "STAFF" },
  { id: 12, name: "Повар", active: true, level: "STAFF" },
] as const;
const members = [
  { id: 20, userId: 20, role: "STAFF", positionId: 11, fullName: "Первый" },
  { id: 30, userId: 30, role: "STAFF", positionId: 12, fullName: "Второй" },
] as const;

function submitInitial(initialData: Partial<ReminderDialogInitial>, canManage = true) {
  const submitted: ReminderRequest[] = [];
  let dialog: ReturnType<typeof ReminderDialog>;
  function Harness() {
    dialog = ReminderDialog({
      open: true,
      canManage,
      positions: [...positions],
      members: [...members],
      currentMemberId: 99,
      initialData: { title: "Test", periodicity: "DAILY", time: "09:00", ...initialData },
      submitting: false,
      onClose: () => {},
      onSubmit: (payload) => submitted.push(payload),
    });
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
  const footer = React.Children.toArray(dialog!.props.footer.props.children) as React.ReactElement<{
    onClick: () => void;
  }>[];
  footer[1].props.onClick();
  return submitted;
}

test("editing multiple positions preserves all selected positions", () => {
  const [payload] = submitInitial({ targetType: "POSITION", targetPositionIds: [11, 12] });
  assert.equal(payload.targetType, "POSITION");
  assert.deepEqual(payload.targetPositionIds, [11, 12]);
  assert.deepEqual(payload.targetMemberIds, []);
});

test("editing multiple employees derives their current positions and preserves both targets", () => {
  const [payload] = submitInitial({ targetType: "MEMBER", targetMemberIds: [20, 30] });
  assert.equal(payload.targetType, "MEMBER");
  assert.deepEqual(payload.targetMemberIds, [20, 30]);
  assert.deepEqual(payload.targetPositionIds, [11, 12]);
});

test("missing employees cannot silently broaden a personal audience to entire positions", () => {
  assert.deepEqual(submitInitial({ targetType: "MEMBER", targetMemberIds: [20, 777] }), []);
});

test("empty position selection cannot be submitted", () => {
  assert.deepEqual(submitInitial({ targetType: "POSITION", targetPositionIds: [] }), []);
});

test("staff self reminders keep their privacy flag and do not acquire a position audience", () => {
  const [payload] = submitInitial({ targetType: "MEMBER", targetMemberIds: [99], visibleToAdmin: false }, false);
  assert.equal(payload.visibleToAdmin, false);
  assert.equal(payload.targetType, "MEMBER");
  assert.deepEqual(payload.targetPositionIds, []);
});

test("multiple member targets are not mistaken for a detached reminder", () => {
  assert.equal(
    isDetachedReminder({
      targetType: "MEMBER",
      targetMember: null,
      targetMembers: [
        { id: 20, userId: 20 },
        { id: 30, userId: 30 },
      ],
    }),
    false,
  );
  assert.equal(isDetachedReminder({ targetType: "MEMBER", targetMember: null, targetMembers: [] }), true);
});
