import assert from "node:assert/strict";
import test from "node:test";
import { deadlineValidation } from "../src/features/employees/utils/invitationDeadline.ts";
import { restaurantLocalDateTimeToInstant } from "../src/features/schedule/utils/date.ts";
import type { InvitationIntentAction } from "../src/features/invitations/api.ts";

const now = Date.parse("2030-10-12T12:00:00Z");
const item = { currentPreferenceDeadline: "2030-10-12T15:00:00Z", newDeadlineRequired: true };
const zone = "Europe/Moscow";

for (const action of ["ADD_TO_COLLECTION", "ADD_AND_REOPEN_COLLECTION", "ADD_AND_REOPEN_FOR_REBUILD"] as const) {
  test(`${action}: future, non-shortening and equal deadlines`, () => {
    const opportunity = { ...item, newDeadlineRequired: action !== "ADD_TO_COLLECTION" };
    for (const [local, message] of [
      ["2030-10-12T14:59", "Дата и время должны быть в будущем."],
      ["2030-10-12T15:00", "Дата и время должны быть в будущем."],
      ["2030-10-12T17:59", "Новый дедлайн не может быть раньше текущего — 12.10.2030, 18:00."],
      ["not-a-date", "Не удалось распознать дату и время."],
      ["2030-02-30T18:00", "Не удалось распознать дату и время."],
    ]) {
      const result = deadlineValidation(opportunity, action, local, zone, now);
      assert.equal(result.valid, false);
      assert.equal(result.error, message);
    }
    for (const local of ["2030-10-12T18:00", "2030-10-12T20:00"]) {
      const result = deadlineValidation(opportunity, action, local, zone, now);
      assert.equal(result.valid, true);
      assert.equal(result.error, null);
      assert.equal(result.requestedDeadline, restaurantLocalDateTimeToInstant(local, zone));
      assert.equal(result.minimum, "2030-10-12T18:00");
    }
    const empty = deadlineValidation(opportunity, action, "", zone, now);
    assert.equal(empty.required, opportunity.newDeadlineRequired);
    assert.equal(empty.valid, !opportunity.newDeadlineRequired);
    assert.equal(empty.error, opportunity.newDeadlineRequired ? "Укажите новый дедлайн." : null);
    assert.equal(
      empty.helper,
      "Новый дедлайн должен быть не раньше текущего: 12.10.2030, 18:00. Дата и время должны быть в будущем.",
    );
    assert.equal(
      empty.applicationHelper,
      action === "ADD_TO_COLLECTION"
        ? "Новый дедлайн будет применён только после принятия приглашения."
        : "После принятия приглашения сбор откроется снова до указанного времени.",
    );
  });
}

test("no or expired current deadline uses the next future minute in restaurant time", () => {
  for (const currentPreferenceDeadline of [null, "2030-10-12T11:00:00Z"]) {
    const result = deadlineValidation(
      { ...item, currentPreferenceDeadline },
      "ADD_AND_REOPEN_COLLECTION",
      "2030-10-12T15:01",
      zone,
      now,
    );
    assert.equal(result.minimum, "2030-10-12T15:01");
    assert.equal(result.valid, true);
    if (!currentPreferenceDeadline) assert.equal(result.helper, "Укажите будущую дату и время.");
  }
  const subMinute = deadlineValidation(
    { ...item, currentPreferenceDeadline: "2030-10-12T15:00:30Z" },
    "ADD_AND_REOPEN_COLLECTION",
    "2030-10-12T18:00",
    zone,
    now,
  );
  assert.equal(subMinute.minimum, "2030-10-12T18:01");
  assert.equal(subMinute.valid, false);
});

test("irrelevant retained input cannot leak into a non-deadline action payload", () => {
  for (const action of [
    "DO_NOT_ADD",
    "ADD_TO_DRAFT",
    "DO_NOT_ADD_TO_DRAFT",
    "INFORMATION_ONLY",
  ] as InvitationIntentAction[]) {
    const result = deadlineValidation(item, action, "invalid retained value", zone, now);
    assert.equal(result.valid, true);
    assert.equal(result.required, false);
    assert.equal(result.requestedDeadline, null);
    assert.equal(result.error, null);
  }
});

test("timezone conversion rejects DST gaps and chooses earlier overlap instant", () => {
  const noCurrent = { currentPreferenceDeadline: null, newDeadlineRequired: true };
  const gap = deadlineValidation(
    noCurrent,
    "ADD_AND_REOPEN_COLLECTION",
    "2030-03-31T02:30",
    "Europe/Berlin",
    Date.parse("2030-01-01T00:00:00Z"),
  );
  assert.equal(gap.error, "Не удалось распознать дату и время.");
  const overlap = deadlineValidation(noCurrent, "ADD_AND_REOPEN_COLLECTION", "2030-10-27T02:30", "Europe/Berlin", now);
  assert.equal(overlap.requestedDeadline, "2030-10-27T00:30:00.000Z");
  assert.equal(
    deadlineValidation(noCurrent, "ADD_AND_REOPEN_COLLECTION", "2030-10-12T20:00", "Invalid/Zone", now).valid,
    false,
  );
});

test("a deadline becomes invalid as time advances without editing", () => {
  const future = deadlineValidation(item, "ADD_AND_REOPEN_COLLECTION", "2030-10-12T18:00", zone, now);
  assert.equal(future.valid, true);
  assert.equal(
    deadlineValidation(
      item,
      "ADD_AND_REOPEN_COLLECTION",
      "2030-10-12T18:00",
      zone,
      Date.parse(future.requestedDeadline!),
    ).error,
    "Дата и время должны быть в будущем.",
  );
});
