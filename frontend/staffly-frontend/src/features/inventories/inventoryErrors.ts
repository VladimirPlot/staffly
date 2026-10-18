export function getFriendlyInventoryError(error: unknown, fallbackMessage: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "friendlyMessage" in error &&
    typeof error.friendlyMessage === "string"
  ) {
    return error.friendlyMessage;
  }

  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;

  return fallbackMessage;
}
