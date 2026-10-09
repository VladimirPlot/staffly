import assert from "node:assert/strict";
import test from "node:test";
import "./registerTsx.ts";
import type { AnnouncementMemberDto } from "../src/features/announcements/api.ts";
const {
  announcementRecipients,
  reconcileSelectedMembers,
  announcementAudienceLabel,
  filterAnnouncementOptions,
} = await import("../src/features/announcements/audience.ts");

const members: AnnouncementMemberDto[] = [
  { id: 1, name: "Менеджер", positionId: 10, positionName: "Менеджер" },
  { id: 2, name: "Иван", positionId: 20, positionName: "Официант" },
  { id: 3, name: "Анна", positionId: 20, positionName: "Официант" },
  { id: 4, name: "Повар", positionId: 30, positionName: "Повар" },
];

test("opening either picker with no search shows all options, including those reached by scrolling", () => {
  const positions = Array.from({ length: 12 }, (_, id) => ({ id, name: `Должность ${id}` }));
  assert.deepEqual(filterAnnouncementOptions(positions, ""), positions);
  assert.deepEqual(filterAnnouncementOptions(positions, "  "), positions);
  assert.deepEqual(filterAnnouncementOptions(members, ""), members);
});

test("search narrows names, surnames and positions, and clearing it restores the full list", () => {
  const options = [
    { id: 1, name: "Иван Петров", detail: "Официант" },
    { id: 2, name: "Анна Иванова", detail: "Уборщица" },
  ];
  assert.deepEqual(filterAnnouncementOptions(options, "  пЕТРов  "), [options[0]]);
  assert.deepEqual(filterAnnouncementOptions(options, "Анна"), [options[1]]);
  assert.deepEqual(filterAnnouncementOptions(options, "убор"), [options[1]]);
  assert.deepEqual(filterAnnouncementOptions(options, "Несуществующее имя"), []);
  assert.deepEqual(filterAnnouncementOptions(options, ""), options);
});

test("everyone includes management and all positions", () => {
  assert.deepEqual(announcementRecipients("ALL", members, [], []), members);
});
test("positions form a union and specific members narrow it", () => {
  assert.deepEqual(
    announcementRecipients("POSITIONS", members, [20, 30], []).map((member) => member.id),
    [2, 3, 4],
  );
  assert.deepEqual(
    announcementRecipients("MEMBERS", members, [20, 30], [2, 4, 4]).map((member) => member.id),
    [2, 4],
  );
  assert.deepEqual(announcementRecipients("MEMBERS", members, [20], [1]), []);
});
test("removing a position removes its people and an empty specific selection does not broadcast", () => {
  const selected = reconcileSelectedMembers(members, [30], [2, 4]);
  assert.deepEqual(selected, [4]);
  assert.deepEqual(reconcileSelectedMembers(members, [10], selected), []);
  assert.deepEqual(announcementRecipients("MEMBERS", members, [10], []), []);
});
test("refresh excludes terminated members and changed positions", () => {
  assert.deepEqual(
    announcementRecipients(
      "MEMBERS",
      members.filter((member) => member.id !== 2),
      [20],
      [2],
    ),
    [],
  );
  const changed = members.map((member) => (member.id === 2 ? { ...member, positionId: 30 } : member));
  assert.deepEqual(announcementRecipients("MEMBERS", changed, [20], [2]), []);
});
test("history distinguishes everyone, positions and specific names", () => {
  const base = { positions: [{ name: "Официант" }], recipients: [{ name: "Иван" }] };
  assert.equal(announcementAudienceLabel({ ...base, audience: "ALL" }), "Всем участникам ресторана");
  assert.equal(announcementAudienceLabel({ ...base, audience: "POSITIONS" }), "Официант");
  assert.equal(announcementAudienceLabel({ ...base, audience: "MEMBERS" }), "Иван");
});
