import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleBuildTemplateDto } from "../src/features/schedule/api.ts";
import {
  canonicalizeWeekdays,
  createPositionConfigDraft,
  deleteWeekdayRegime,
  draftToSaveRequest,
  splitWeekdayRegime,
  templateDtoToDraft,
  validateBuildTemplateDraft,
  validateWeekdayPartition,
  WEEKDAYS,
} from "../src/features/schedule/utils/buildTemplateDraft.ts";

const completeConfig = () => {
  const config = createPositionConfigDraft();
  config.positionIds = [1];
  const regime = config.weekdayRegimes[0];
  regime.workPeriodStart = "10:00";
  regime.workPeriodEnd = "00:00";
  regime.shiftOptions[0] = { startTime: "10:00", endTime: "00:00", label: "День", sortOrder: 0 };
  return config;
};

test("new block has one complete Monday-first regime and canonical order", () => {
  assert.deepEqual(
    createPositionConfigDraft().weekdayRegimes.map((r) => r.daysOfWeek),
    [WEEKDAYS],
  );
  assert.deepEqual(canonicalizeWeekdays(["FRIDAY", "MONDAY", "WEDNESDAY"]), ["MONDAY", "WEDNESDAY", "FRIDAY"]);
});

test("split creates exact complement and a second split changes only its source", () => {
  const split = splitWeekdayRegime(completeConfig().weekdayRegimes, 0, ["FRIDAY", "MONDAY", "WEDNESDAY"]);
  assert.deepEqual(
    split.map((r) => r.daysOfWeek),
    [
      ["MONDAY", "WEDNESDAY", "FRIDAY"],
      ["TUESDAY", "THURSDAY", "SATURDAY", "SUNDAY"],
    ],
  );
  const unrelated = split[0];
  const twice = splitWeekdayRegime(split, 1, ["TUESDAY", "THURSDAY"]);
  assert.strictEqual(twice[0], unrelated);
  assert.deepEqual(
    twice.map((r) => r.daysOfWeek),
    [
      ["MONDAY", "WEDNESDAY", "FRIDAY"],
      ["TUESDAY", "THURSDAY"],
      ["SATURDAY", "SUNDAY"],
    ],
  );
  assert.equal(validateWeekdayPartition(twice), null);
});

test("empty selection is rejected and a regime cannot take a neighbour day", () => {
  const original = completeConfig().weekdayRegimes;
  assert.deepEqual(splitWeekdayRegime(original, 0, []), original);
  const split = splitWeekdayRegime(original, 0, ["MONDAY"]);
  assert.deepEqual(
    splitWeekdayRegime(split, 0, ["MONDAY", "TUESDAY"]).map((r) => r.daysOfWeek),
    [["MONDAY"], ["TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]],
  );
});

test("split clones nested rules without identity and partitions regime-owned overrides", () => {
  const regimes = completeConfig().weekdayRegimes;
  regimes[0].coverageRules = [{ dayOfWeek: 1, startTime: "10:00", endTime: "00:00", requiredCount: 2, sortOrder: 0 }];
  regimes[0].coverageDateOverrides = [
    { date: "2026-09-21", shiftOptionIndex: 0, requiredCount: 3 },
    { date: "2026-09-22", shiftOptionIndex: 0, requiredCount: 4 },
  ];
  const split = splitWeekdayRegime(regimes, 0, ["MONDAY"]);
  assert.notEqual(split[0].key, split[1].key);
  assert.notStrictEqual(split[0].shiftOptions[0], split[1].shiftOptions[0]);
  assert.equal(split[1].coverageRules.length, 0);
  assert.deepEqual(
    split.map((r) => r.coverageDateOverrides.map((o) => o.date)),
    [["2026-09-21"], ["2026-09-22"]],
  );
  split[1].shiftOptions[0].label = "changed";
  assert.equal(split[0].shiftOptions[0].label, "День");
});

test("validator rejects overlap, missing days, and empty regimes", () => {
  const regime = completeConfig().weekdayRegimes[0];
  assert.match(validateWeekdayPartition([{ ...regime, daysOfWeek: ["MONDAY"] }])!, /семь/);
  assert.match(validateWeekdayPartition([{ ...regime }, { ...regime, key: "other" }])!, /пересекаться/);
  assert.match(validateWeekdayPartition([{ ...regime, daysOfWeek: [] }])!, /хотя бы один/);
});

test("deleting a second regime returns its days to the base and preserves base settings", () => {
  const split = splitWeekdayRegime(completeConfig().weekdayRegimes, 0, ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"]);
  const baseShift = split[0].shiftOptions;
  split[1].workPeriodEnd = "06:00";
  const result = deleteWeekdayRegime(split, 1);
  assert.deepEqual(result[0].daysOfWeek, WEEKDAYS);
  assert.strictEqual(result[0].shiftOptions, baseShift);
  assert.equal(result[0].workPeriodEnd, "00:00");
  assert.equal(validateWeekdayPartition(result), null);
});

const threeRegimes = () => {
  const firstSplit = splitWeekdayRegime(completeConfig().weekdayRegimes, 0, ["MONDAY", "TUESDAY", "WEDNESDAY"]);
  return splitWeekdayRegime(firstSplit, 1, ["THURSDAY", "FRIDAY"]);
};

test("deleting the third regime returns its days to the first, not the previous regime", () => {
  const regimes = threeRegimes();
  const second = regimes[1];
  const result = deleteWeekdayRegime(regimes, 2);
  assert.deepEqual(
    result.map((regime) => regime.daysOfWeek),
    [
      ["MONDAY", "TUESDAY", "WEDNESDAY", "SATURDAY", "SUNDAY"],
      ["THURSDAY", "FRIDAY"],
    ],
  );
  assert.strictEqual(result[1], second);
  assert.equal(validateWeekdayPartition(result), null);
});

test("deleting the middle regime preserves the later regime unchanged", () => {
  const regimes = threeRegimes();
  const third = regimes[2];
  const result = deleteWeekdayRegime(regimes, 1);
  assert.deepEqual(
    result.map((regime) => regime.daysOfWeek),
    [
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      ["SATURDAY", "SUNDAY"],
    ],
  );
  assert.strictEqual(result[1], third);
  assert.equal(validateWeekdayPartition(result), null);
});

test("the base or only regime cannot be deleted", () => {
  const only = completeConfig().weekdayRegimes;
  assert.deepEqual(deleteWeekdayRegime(only, 0), only);
  assert.equal(deleteWeekdayRegime(only, 4).length, 1);
});

test("deleted regime settings are discarded rather than migrated to the base", () => {
  const regimes = splitWeekdayRegime(completeConfig().weekdayRegimes, 0, ["MONDAY"]);
  regimes[1].workPeriodStart = "21:00";
  regimes[1].shiftOptions = [{ startTime: "21:00", endTime: "06:00", label: "Удалить", sortOrder: 0 }];
  regimes[1].coverageRules = [{ dayOfWeek: 2, startTime: "21:00", endTime: "06:00", requiredCount: 9, sortOrder: 0 }];
  regimes[1].coverageDateOverrides = [{ date: "2026-09-22", shiftOptionIndex: 0, requiredCount: 9 }];
  const result = deleteWeekdayRegime(regimes, 1);
  assert.equal(result[0].workPeriodStart, "10:00");
  assert.equal(result[0].shiftOptions[0].label, "День");
  assert.deepEqual(result[0].coverageRules, []);
  assert.deepEqual(result[0].coverageDateOverrides, []);
});

test("delete survives request and DTO hydration with a valid partition", () => {
  const config = completeConfig();
  config.weekdayRegimes = deleteWeekdayRegime(threeRegimes(), 1);
  const request = draftToSaveRequest({ name: "После удаления", description: "", positionConfigs: [config] });
  const savedConfig = request.positionConfigs[0];
  const dto = {
    id: 9,
    version: 1,
    name: request.name,
    description: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    positionConfigs: [
      {
        ...savedConfig,
        id: 1,
        positionNames: ["Официант"],
        weekdayRegimes: savedConfig.weekdayRegimes.map((regime, index) => ({
          ...regime,
          id: index + 1,
          shiftOptions: regime.shiftOptions.map((item, childIndex) => ({ ...item, id: childIndex + 1 })),
          coverageRules: regime.coverageRules.map((item, childIndex) => ({ ...item, id: childIndex + 1 })),
          coverageDateOverrides: regime.coverageDateOverrides.map((item, childIndex) => ({
            ...item,
            id: childIndex + 1,
          })),
        })),
      },
    ],
  } satisfies ScheduleBuildTemplateDto;
  const reopened = templateDtoToDraft(dto);
  assert.equal(validateWeekdayPartition(reopened.positionConfigs[0].weekdayRegimes), null);
  assert.deepEqual(draftToSaveRequest(reopened).positionConfigs[0].weekdayRegimes, savedConfig.weekdayRegimes);
});

test("multi-regime request-response round trip retains partition and settings", () => {
  const config = completeConfig();
  config.weekdayRegimes = splitWeekdayRegime(config.weekdayRegimes, 0, [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "SUNDAY",
  ]);
  config.weekdayRegimes[1].workPeriodEnd = "06:00";
  config.weekdayRegimes[1].shiftOptions.push({ startTime: "21:00", endTime: "06:00", label: "Ночь", sortOrder: 1 });
  const request = draftToSaveRequest({ name: "Шаблон", description: "", positionConfigs: [config] });
  const dto = {
    id: 1,
    version: 2,
    name: request.name,
    description: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    positionConfigs: request.positionConfigs.map((c, i) => ({
      ...c,
      id: i + 1,
      positionNames: ["Официант"],
      weekdayRegimes: c.weekdayRegimes.map((r, ri) => ({
        ...r,
        id: ri + 10,
        shiftOptions: r.shiftOptions.map((o, oi) => ({ ...o, id: oi + 20 })),
        coverageRules: r.coverageRules.map((o, oi) => ({ ...o, id: oi + 30 })),
        coverageDateOverrides: r.coverageDateOverrides.map((o, oi) => ({ ...o, id: oi + 40 })),
      })),
    })),
  } satisfies ScheduleBuildTemplateDto;
  const reopened = templateDtoToDraft(dto);
  assert.deepEqual(
    draftToSaveRequest(reopened).positionConfigs[0].weekdayRegimes,
    request.positionConfigs[0].weekdayRegimes,
  );
  assert.equal(reopened.positionConfigs[0].weekdayRegimes[1].shiftOptions[1].startTime, "21:00");
});

test("malformed partition blocks save; single all-week regime remains compatible", () => {
  const config = completeConfig();
  const draft = { name: "Шаблон", description: "", positionConfigs: [config] };
  assert.equal(validateBuildTemplateDraft(draft), null);
  config.weekdayRegimes[0].daysOfWeek = ["MONDAY"];
  assert.match(validateBuildTemplateDraft(draft)!, /семь/);
});

test("marker transport data survives DTO draft request round trip without marker UI", () => {
  const config = completeConfig();
  const request = draftToSaveRequest({ name: "Шаблон", description: "", positionConfigs: [config] });
  const dto = {
    id: 1,
    version: 1,
    name: "Шаблон",
    description: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    positionConfigs: [
      {
        ...request.positionConfigs[0],
        id: 2,
        positionNames: ["Официант"],
        markers: [{ id: 7, name: "Клуб", memberIds: [12, 18] }],
        weekdayRegimes: request.positionConfigs[0].weekdayRegimes.map((regime, index) => ({
          ...regime,
          id: index + 1,
          shiftOptions: regime.shiftOptions.map((option, optionIndex) => ({ ...option, id: optionIndex + 1 })),
          coverageRules: [],
          coverageDateOverrides: [],
        })),
      },
    ],
  } satisfies ScheduleBuildTemplateDto;

  const roundTrip = draftToSaveRequest(templateDtoToDraft(dto)).positionConfigs[0];
  assert.equal(roundTrip.id, 2);
  assert.deepEqual(roundTrip.markers, [{ id: 7, name: "Клуб", memberIds: [12, 18] }]);
});

test("new position configs and markers never inherit persistence ids", () => {
  const config = createPositionConfigDraft();
  config.markers.push({ key: "new-marker", name: "Новый", memberIds: [] });

  const request = draftToSaveRequest({ name: "Шаблон", description: "", positionConfigs: [config] });

  assert.equal(request.positionConfigs[0].id, null);
  assert.equal(request.positionConfigs[0].markers[0].id, null);
});

test("marker affinity survives DTO hydration, unrelated edits, and save serialization", () => {
  const config = completeConfig();
  const base = draftToSaveRequest({ name: "Шаблон", description: "", positionConfigs: [config] }).positionConfigs[0];
  const dto = {
    id: 1,
    version: 1,
    name: "Шаблон",
    description: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
    positionConfigs: [
      {
        ...base,
        id: 2,
        positionNames: ["Официант"],
        markers: [{ id: 42, name: "Клуб", memberIds: [12] }],
        weekdayRegimes: base.weekdayRegimes.map((regime, index) => ({
          ...regime,
          id: index + 1,
          shiftOptions: regime.shiftOptions.map((option, childIndex) => ({
            ...option,
            id: childIndex + 1,
            markerId: 42,
          })),
          coverageRules: [],
          coverageDateOverrides: [],
        })),
      },
    ],
  } satisfies ScheduleBuildTemplateDto;

  const draft = templateDtoToDraft(dto);
  draft.description = "unrelated";
  assert.equal(draftToSaveRequest(draft).positionConfigs[0].weekdayRegimes[0].shiftOptions[0].markerIndex, 0);
});

test("new unpersisted marker can be referenced and marker reordering is resolved at serialization", () => {
  const config = completeConfig();
  config.markers = [
    { key: "a", id: null, name: "A", memberIds: [] },
    { key: "club", id: null, name: "Клуб", memberIds: [12] },
  ];
  config.weekdayRegimes[0].shiftOptions[0].markerKey = "club";
  config.markers.reverse();

  const request = draftToSaveRequest({ name: "Шаблон", description: "", positionConfigs: [config] });
  assert.equal(request.positionConfigs[0].markers[0].id, null);
  assert.equal(request.positionConfigs[0].weekdayRegimes[0].shiftOptions[0].markerIndex, 0);
});

test("split preserves the same marker affinity without cloning a marker", () => {
  const config = completeConfig();
  config.markers = [{ key: "club", id: 42, name: "Клуб", memberIds: [12] }];
  config.weekdayRegimes[0].shiftOptions[0].markerKey = "club";
  const split = splitWeekdayRegime(config.weekdayRegimes, 0, ["MONDAY"]);
  assert.equal(split[0].shiftOptions[0].markerKey, "club");
  assert.equal(split[1].shiftOptions[0].markerKey, "club");
  assert.equal(config.markers.length, 1);
});

test("deleted marker key is rejected instead of silently binding to a reindexed marker", () => {
  const config = completeConfig();
  config.markers = [{ key: "other", id: 2, name: "Другой", memberIds: [] }];
  config.weekdayRegimes[0].shiftOptions[0].markerKey = "deleted";
  assert.throws(
    () => draftToSaveRequest({ name: "Шаблон", description: "", positionConfigs: [config] }),
    /missing from its position config/,
  );
});
