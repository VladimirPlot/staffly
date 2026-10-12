import assert from "node:assert/strict";
import test from "node:test";
import { allExamAudienceIds, toggleExamAudience } from "../src/features/training/components/examEditor/audience.ts";
import type { PositionDto } from "../src/features/dictionaries/api.ts";
import "./registerTsx.ts";
const { buildAvailabilityLabel, resolveInitialVisibilityPositionIds } = await import(
  "../src/features/training/components/examEditor/utils.ts"
);

const positions = [1, 2, 3].map((id) => ({
  id,
  name: `Position ${id}`,
  active: true,
  level: "STAFF",
})) as PositionDto[];
const manageable = new Set([1, 2, 3]);

test("first specific choice from everyone selects only that position in both editors", () => {
  for (const mode of ["PRACTICE", "CERTIFICATION"] as const) {
    const initial = mode === "PRACTICE" ? [] : [1, 2, 3];
    const first = toggleExamAudience(mode, true, initial, 2, positions, manageable);
    assert.deepEqual(first, { ids: [2], allSelected: false });
    assert.deepEqual(toggleExamAudience(mode, false, first.ids, 3, positions, manageable), {
      ids: [2, 3],
      allSelected: false,
    });
  }
});

test("removing the last specific choice returns to everyone with mode-specific serialization", () => {
  assert.deepEqual(toggleExamAudience("PRACTICE", false, [2], 2, positions, manageable), {
    ids: [],
    allSelected: true,
  });
  assert.deepEqual(toggleExamAudience("CERTIFICATION", false, [2], 2, positions, manageable), {
    ids: [1, 2, 3],
    allSelected: true,
  });
});

test("the only position can still be shown as an explicit choice instead of everyone", () => {
  const selection = toggleExamAudience("CERTIFICATION", true, [1], 1, positions.slice(0, 1), new Set([1]));
  assert.equal(selection.allSelected, false);
  assert.equal(
    buildAvailabilityLabel("CERTIFICATION", selection.ids, positions.slice(0, 1), true, false),
    "Position 1",
  );
});

test("switching from everyone preserves historical and unmanageable references", () => {
  const dictionary = [...positions, { id: 4, name: "Archived", active: false, level: "STAFF" }] as PositionDto[];
  assert.deepEqual(toggleExamAudience("CERTIFICATION", true, [1, 2, 3, 4, 99], 2, dictionary, manageable), {
    ids: [4, 99, 2],
    allSelected: false,
  });
  assert.deepEqual(allExamAudienceIds(dictionary, manageable, [4, 99]), [4, 99, 1, 2, 3]);
  assert.deepEqual(resolveInitialVisibilityPositionIds("CERTIFICATION", [4, 99], [1, 2, 3]), [4, 99]);
});

test("unmanageable and newly inactive positions cannot be added or removed silently", () => {
  assert.deepEqual(toggleExamAudience("CERTIFICATION", false, [3], 3, positions, new Set([1, 2])), {
    ids: [3],
    allSelected: false,
  });
  const inactive = [{ ...positions[0], active: false }];
  assert.deepEqual(toggleExamAudience("CERTIFICATION", false, [2], 1, inactive, manageable), {
    ids: [2],
    allSelected: false,
  });
});
