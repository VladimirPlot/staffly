export function getFriendlyInventoryError(error: unknown, fallbackMessage: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "friendlyMessage" in error &&
    typeof error.friendlyMessage === "string"
  ) {
    return error.friendlyMessage;
  }

  return fallbackMessage;
}
