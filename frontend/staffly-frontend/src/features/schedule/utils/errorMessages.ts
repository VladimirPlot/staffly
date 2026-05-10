type FriendlyError = {
  friendlyMessage?: unknown;
};

export function getFriendlyScheduleErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error == null) {
    return fallback;
  }

  const maybeError = error as FriendlyError;
  return typeof maybeError.friendlyMessage === "string" && maybeError.friendlyMessage.trim().length > 0
    ? maybeError.friendlyMessage
    : fallback;
}
