type FriendlyError = {
  friendlyMessage?: unknown;
  response?: { data?: { error?: unknown } };
};

export function getFriendlyScheduleErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error == null) {
    return fallback;
  }

  const maybeError = error as FriendlyError;
  if (maybeError.response?.data?.error === "SCHEDULE_VERSION_CONFLICT") {
    return "График был изменён другим пользователем. Ваши локальные изменения не отправлены. Закройте график и откройте его заново, затем повторите действие.";
  }
  return typeof maybeError.friendlyMessage === "string" && maybeError.friendlyMessage.trim().length > 0
    ? maybeError.friendlyMessage
    : fallback;
}
