import assert from "node:assert/strict";
import test from "node:test";

import {
  getScheduleActionMessage,
  getTemplateConfirmationMeta,
  getTemplateErrorCode,
  TEMPLATE_VERSION_CONFLICT,
} from "../src/features/schedule/utils/buildTemplateConfirmation.ts";

const confirmationError = {
  response: {
    data: {
      error: "SCHEDULE_BUILD_TEMPLATE_CHANGE_CONFIRMATION_REQUIRED",
      meta: {
        impact: "PREFERENCE_AFFECTING",
        schedules: [
          {
            scheduleId: 42,
            scheduleTitle: "Сентябрь",
            status: "COLLECTING_PREFERENCES",
            action: "RESET_PREFERENCE_COLLECTION",
          },
        ],
        summary: {
          linkedScheduleCount: 1,
          noActionCount: 0,
          keepPreferencesCount: 0,
          invalidateAppliedAutoBuildCount: 0,
          resetPreferenceCollectionCount: 1,
          publishedUnchangedCount: 0,
        },
        hasDestructiveConsequences: true,
      },
    },
  },
};

test("reads the backend confirmation plan without deriving lifecycle impact", () => {
  assert.deepEqual(getTemplateConfirmationMeta(confirmationError), confirmationError.response.data.meta);
  assert.equal(getTemplateConfirmationMeta({ response: { data: { error: TEMPLATE_VERSION_CONFLICT } } }), null);
});

test("keeps preference reset distinct from auto-build invalidation", () => {
  assert.match(getScheduleActionMessage("RESET_PREFERENCE_COLLECTION"), /удалены/);
  assert.match(getScheduleActionMessage("INVALIDATE_APPLIED_AUTO_BUILD"), /Пожелания сотрудников сохранятся/);
  assert.match(getScheduleActionMessage("KEEP_PREFERENCES"), /сохранятся/);
});

test("recognizes template version conflicts separately", () => {
  assert.equal(
    getTemplateErrorCode({ response: { data: { error: TEMPLATE_VERSION_CONFLICT } } }),
    TEMPLATE_VERSION_CONFLICT,
  );
});
