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
  if (maybeError.response?.data?.error === "AUTO_BUILD_PREVIEW_STALE") {
    return "Предпросмотр автосборки устарел, потому что данные графика изменились. Постройте автосборку заново.";
  }
  if (maybeError.response?.data?.error === "SCHEDULE_PREFERENCE_COLLECTION_CLOSED") {
    return "Сбор пожеланий уже закрыт. Обновите список графиков.";
  }
  if (maybeError.response?.data?.error === "SCHEDULE_BUILD_TEMPLATE_LOCKED_BY_PREFERENCE_COLLECTION") {
    return "Этот шаблон сейчас используется для сбора пожеланий и временно заблокирован для редактирования.";
  }
  if (maybeError.response?.data?.error === "SHIFT_REQUEST_ALREADY_DECIDED") {
    return "Эта заявка уже обработана другим пользователем. Список заявок обновлён.";
  }
  return typeof maybeError.friendlyMessage === "string" && maybeError.friendlyMessage.trim().length > 0
    ? maybeError.friendlyMessage
    : fallback;
}
