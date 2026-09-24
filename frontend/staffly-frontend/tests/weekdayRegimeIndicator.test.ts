import assert from "node:assert/strict";
import test from "node:test";

import type { DayOfWeek, ScheduleBuildTemplateDto } from "../src/features/schedule/api.ts";
import {
  formatWeekdayRegimeLabel,
  getWeekdayRegimeIndicator,
} from "../src/features/schedule/utils/weekdayRegimeIndicator.ts";

const DAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const template = (...partitions: Array<{ positionId: number; regimes: DayOfWeek[][] }>): ScheduleBuildTemplateDto => ({
  id: 1,
  version: 1,
  name: "Шаблон",
  description: null,
  isActive: true,
  createdAt: null,
  updatedAt: null,
  positionConfigs: partitions.map(({ positionId, regimes }, configIndex) => ({
    id: configIndex + 1,
    positionIds: [positionId],
    positionNames: [],
    targetPattern: "NONE",
    minRestHours: null,
    minRestMode: "SOFT",
    maxShiftsPerPeriod: null,
    heavyDaysOfWeek: [],
    sortOrder: configIndex,
    weekdayRegimes: regimes.map((daysOfWeek, regimeIndex) => ({
      id: regimeIndex + 1,
      daysOfWeek,
      workPeriodStart: "10:00",
      workPeriodEnd: "00:00",
      shiftOptions: [],
      coverageRules: [],
      coverageDateOverrides: [],
      sortOrder: regimeIndex,
    })),
  })),
});

test("single all-week regime has no indicator", () => {
  assert.equal(
    getWeekdayRegimeIndicator({
      template: template({ positionId: 1, regimes: [DAYS] }),
      positionId: 1,
      businessDate: "2026-10-02",
    }),
    null,
  );
});

test("multi-regime indicator is selected by business weekday, including overnight shifts", () => {
  const value = template({ positionId: 1, regimes: [DAYS.slice(0, 4), DAYS.slice(4)] });
  assert.deepEqual(getWeekdayRegimeIndicator({ template: value, positionId: 1, businessDate: "2026-10-02" }), {
    label: "Пт–Вс",
    title: "Для этой даты действует режим Пт–Вс",
  });
  // Only the Friday business date is an input: an overnight shift's end instant cannot move this to Saturday.
  assert.equal(getWeekdayRegimeIndicator({ template: value, positionId: 1, businessDate: "2026-10-02" })?.label, "Пт–Вс");
});

test("non-contiguous weekdays use an explicit Monday-first label", () => {
  const oddDays: DayOfWeek[] = ["FRIDAY", "MONDAY", "WEDNESDAY"];
  const value = template({ positionId: 1, regimes: [oddDays, ["TUESDAY", "THURSDAY", "SATURDAY", "SUNDAY"]] });
  assert.equal(formatWeekdayRegimeLabel(oddDays), "Пн, Ср, Пт");
  assert.equal(
    getWeekdayRegimeIndicator({ template: value, positionId: 1, businessDate: "2026-10-02" })?.label,
    "Пн, Ср, Пт",
  );
});

test("the same date has position-scoped indicator semantics", () => {
  const value = template(
    { positionId: 1, regimes: [DAYS.slice(0, 4), DAYS.slice(4)] },
    {
      positionId: 2,
      regimes: [
        ["MONDAY", "WEDNESDAY", "FRIDAY"],
        ["TUESDAY", "THURSDAY", "SATURDAY", "SUNDAY"],
      ],
    },
  );
  assert.equal(getWeekdayRegimeIndicator({ template: value, positionId: 1, businessDate: "2026-10-02" })?.label, "Пт–Вс");
  assert.equal(
    getWeekdayRegimeIndicator({ template: value, positionId: 2, businessDate: "2026-10-02" })?.label,
    "Пн, Ср, Пт",
  );
});

test("missing, malformed, or ambiguous template data safely has no indicator", () => {
  assert.equal(getWeekdayRegimeIndicator({ template: null, positionId: 1, businessDate: "2026-10-02" }), null);
  assert.equal(
    getWeekdayRegimeIndicator({
      template: template({ positionId: 1, regimes: [DAYS.slice(0, 4), DAYS.slice(4)] }),
      positionId: 99,
      businessDate: "2026-10-02",
    }),
    null,
  );
  assert.equal(
    getWeekdayRegimeIndicator({
      template: template({ positionId: 1, regimes: [["MONDAY"], ["MONDAY", ...DAYS.slice(1)]] }),
      positionId: 1,
      businessDate: "2026-10-02",
    }),
    null,
  );
  const ambiguous = template(
    { positionId: 1, regimes: [DAYS.slice(0, 4), DAYS.slice(4)] },
    { positionId: 1, regimes: [DAYS.slice(0, 5), DAYS.slice(5)] },
  );
  assert.equal(getWeekdayRegimeIndicator({ template: ambiguous, positionId: 1, businessDate: "2026-10-02" }), null);
  assert.equal(
    getWeekdayRegimeIndicator({
      template: template({ positionId: 1, regimes: [DAYS.slice(0, 4), DAYS.slice(4)] }),
      positionId: 1,
      businessDate: "invalid",
    }),
    null,
  );
});
