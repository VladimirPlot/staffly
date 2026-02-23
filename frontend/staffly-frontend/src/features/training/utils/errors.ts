import { getErrorMessage } from "../../../shared/utils/errors";

export function getTrainingErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as { friendlyMessage?: string };
  if (typeof maybeError?.friendlyMessage === "string" && maybeError.friendlyMessage.trim().length > 0) {
    return maybeError.friendlyMessage;
  }
  return getErrorMessage(error, fallback);
}
