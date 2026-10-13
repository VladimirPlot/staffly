import assert from "node:assert/strict";
import test from "node:test";
import { folderMatchesPositionRole, trainingPreparationAccess } from "../src/features/training/utils/folderRole.ts";
import { getManageableAudienceRoles } from "../src/features/training/utils/certificationRoleScope.ts";
import type { TrainingFolderDto } from "../src/features/training/api/types.ts";

test("training examiner can select ADMIN even with a STAFF membership", () => {
  assert.deepEqual(getManageableAudienceRoles({ isCreator: false, isExaminer: true, membershipRole: "STAFF" }), [
    "STAFF",
    "MANAGER",
    "ADMIN",
  ]);
  assert.deepEqual(getManageableAudienceRoles({ isCreator: false, isExaminer: false, membershipRole: "ADMIN" }), [
    "STAFF",
    "MANAGER",
  ]);
  assert.deepEqual(getManageableAudienceRoles({ isCreator: false, isExaminer: false, membershipRole: "MANAGER" }), [
    "STAFF",
  ]);
  assert.deepEqual(getManageableAudienceRoles({ isCreator: true, isExaminer: false, membershipRole: null }), [
    "STAFF",
    "MANAGER",
    "ADMIN",
  ]);
});

test("folder navigation follows the job level rather than a list of job IDs", () => {
  const folder = {
    type: "CERTIFICATION",
    targetRole: "MANAGER",
    visibilityPositionIds: [],
  } as unknown as TrainingFolderDto;
  // Both floor manager and sous-chef have the same level regardless of their different position IDs.
  assert.equal(folderMatchesPositionRole(folder, "MANAGER"), true);
  assert.equal(folderMatchesPositionRole(folder, "STAFF"), false);
  assert.equal(folderMatchesPositionRole(folder, undefined), false);
});

test("access descriptions explain the training-only overrides", () => {
  assert.equal(trainingPreparationAccess("STAFF"), "MANAGER, ADMIN, EXAMINER и CREATOR");
  assert.equal(trainingPreparationAccess("MANAGER"), "ADMIN, EXAMINER и CREATOR");
  assert.equal(trainingPreparationAccess("ADMIN"), "EXAMINER и CREATOR");
});
