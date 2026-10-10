import assert from "node:assert/strict";
import test from "node:test";
import { formatAnnouncementSentAt } from "../src/features/announcements/sentAt.ts";

test("announcement date and time follow the restaurant zone across midnight", () => {
  const sentAt = "2026-10-09T21:21:13.870978Z";
  assert.equal(formatAnnouncementSentAt(sentAt, "Europe/Moscow"), "10.10.2026, 00:21");
  assert.equal(formatAnnouncementSentAt(sentAt, "Asia/Vladivostok"), "10.10.2026, 07:21");
  assert.equal(formatAnnouncementSentAt(sentAt, "UTC"), "09.10.2026, 21:21");
});

test("IANA daylight saving rules apply to the historical send instant", () => {
  assert.equal(formatAnnouncementSentAt("2026-01-15T12:05:00Z", "America/New_York"), "15.01.2026, 07:05");
  assert.equal(formatAnnouncementSentAt("2026-07-15T12:05:00Z", "America/New_York"), "15.07.2026, 08:05");
});

test("unknown dates or missing restaurant zone never use device-local time", () => {
  assert.equal(formatAnnouncementSentAt("invalid", "Europe/Moscow"), "Дата и время недоступны");
  assert.equal(formatAnnouncementSentAt("2026-10-09T21:21:00Z", null), "Дата и время недоступны");
});
