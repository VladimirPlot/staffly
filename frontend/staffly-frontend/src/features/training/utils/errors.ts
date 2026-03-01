import { getErrorMessage } from "../../../shared/utils/errors";
import { parseTrainingApiError } from "./trainingApiError";

export function getTrainingErrorMessage(error: unknown, fallback: string): string {
  const parsed = parseTrainingApiError(error);
  if (parsed.message && parsed.message.trim().length > 0) {
    return parsed.message;
  }

  const maybeError = error as { friendlyMessage?: string };
  if (typeof maybeError?.friendlyMessage === "string" && maybeError.friendlyMessage.trim().length > 0) {
    return maybeError.friendlyMessage;
  }
  return getErrorMessage(error, fallback);
}
