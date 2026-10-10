import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import type { ReminderRequest } from "../src/features/reminders/api.ts";

const { default: ReminderDialog } = await import("../src/features/reminders/components/ReminderDialog.tsx");
const { isDetachedReminder } = await import("../src/features/reminders/reminderTarget.ts");

test("only MEMBER reminders without a member are detached, regardless of creator or current employment", () => {
  assert.equal(isDetachedReminder({ targetType: "MEMBER", targetMember: null }), true);
  assert.equal(isDetachedReminder({ targetType: "MEMBER" }), true);
  assert.equal(isDetachedReminder({ targetType: "ALL", targetMember: null }), false);
  assert.equal(isDetachedReminder({ targetType: "POSITION", targetMember: null }), false);
  assert.equal(isDetachedReminder({ targetType: "MEMBER", targetMember: { id: 99, userId: 8 } }), false);
});

// Inspect the real dialog's controls without mounting its DOM portal.
for (const canManage of [true, false]) {
  test(`detached dialog cannot save or silently retarget (canManage=${canManage})`, () => {
    const submitted: ReminderRequest[] = [];
    let dialog: ReturnType<typeof ReminderDialog>;
    function Harness() {
      dialog = ReminderDialog({
        open: true,
        canManage,
        positions: [],
        members: [],
        currentMemberId: 99, // Rehire or a different actor must not become the detached target.
        initialData: {
          title: "Напоминание",
          targetType: "MEMBER",
          targetMemberId: null,
          periodicity: "DAILY",
          time: "09:00",
        },
        submitting: false,
        onClose: () => {},
        onSubmit: (payload) => submitted.push(payload),
      });
      return null;
    }
    renderToStaticMarkup(React.createElement(Harness));
    const footer = React.Children.toArray(dialog!.props.footer.props.children) as React.ReactElement<{
      disabled: boolean;
      onClick: () => void;
    }>[];
    assert.equal(footer[1].props.disabled, true);
    footer[1].props.onClick();
    assert.deepEqual(submitted, []);
    const html = renderToStaticMarkup(dialog!.props.children);
    assert.match(html, /Сотрудник больше не работает\. Напоминание отключено\./);
    const fields = React.Children.toArray(dialog!.props.children.props.children) as React.ReactElement<{
      label?: string;
      value?: string;
    }>[];
    const target = fields.find((field) => field.props?.label === "Кому");
    assert.equal(target?.props.value, "detached");
  });
}

for (const [selection, targetType, targetMemberId, targetPositionId] of [
  ["", "ALL", null, null],
  ["me", "MEMBER", 99, null],
  ["7", "POSITION", null, 7],
] as const) {
  test(`manager explicitly selecting '${selection}' can reactivate with the selected scope`, () => {
    let dialog: ReturnType<typeof ReminderDialog>;
    const submitted: ReminderRequest[] = [];
    let selected = false;
    function Harness() {
      dialog = ReminderDialog({
        open: true,
        canManage: true,
        positions: [],
        members: [],
        currentMemberId: 99,
        initialData: {
          title: "Напоминание",
          targetType: "MEMBER",
          targetMemberId: null,
          periodicity: "DAILY",
          time: "09:00",
        },
        submitting: false,
        onClose: () => {},
        onSubmit: (payload) => submitted.push(payload),
      });
      if (!selected) {
        selected = true;
        const fields = React.Children.toArray(dialog.props.children.props.children) as React.ReactElement<{
          label?: string;
          onChange?: (event: { target: { value: string } }) => void;
        }>[];
        fields.find((field) => field.props?.label === "Кому")!.props.onChange!({ target: { value: selection } });
      }
      return null;
    }
    renderToStaticMarkup(React.createElement(Harness));
    const footer = React.Children.toArray(dialog!.props.footer.props.children) as React.ReactElement<{
      disabled: boolean;
      onClick: () => void;
    }>[];
    assert.equal(footer[1].props.disabled, false);
    footer[1].props.onClick();
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].targetType, targetType);
    assert.equal(submitted[0].targetMemberId, targetMemberId);
    assert.equal(submitted[0].targetPositionId, targetPositionId);
  });
}
