import type { SchedulePreferenceMyResponse } from "./api";

export function completeOwnSchedulePreferenceSubmit(
  response: SchedulePreferenceMyResponse,
  cleanupDraft: () => void,
  isCurrentRequest: () => boolean,
  publishResponse: (response: SchedulePreferenceMyResponse) => void,
): boolean {
  cleanupDraft();
  if (!isCurrentRequest()) return false;
  publishResponse(response);
  return true;
}
