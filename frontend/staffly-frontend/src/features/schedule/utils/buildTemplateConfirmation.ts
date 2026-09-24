import type { ScheduleBuildTemplateConfirmationMeta, ScheduleBuildTemplateScheduleAction } from "../api";

export const TEMPLATE_CONFIRMATION_REQUIRED = "SCHEDULE_BUILD_TEMPLATE_CHANGE_CONFIRMATION_REQUIRED";
export const TEMPLATE_VERSION_CONFLICT = "SCHEDULE_BUILD_TEMPLATE_VERSION_CONFLICT";

type ApiError = {
  response?: { data?: { error?: unknown; meta?: unknown } };
};

const actions: ScheduleBuildTemplateScheduleAction[] = [
  "NO_ACTION",
  "KEEP_PREFERENCES",
  "INVALIDATE_APPLIED_AUTO_BUILD",
  "RESET_PREFERENCE_COLLECTION",
  "PUBLISHED_UNCHANGED",
];

export function getTemplateErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as ApiError).response?.data?.error;
  return typeof code === "string" ? code : null;
}

export function getTemplateConfirmationMeta(error: unknown): ScheduleBuildTemplateConfirmationMeta | null {
  if (getTemplateErrorCode(error) !== TEMPLATE_CONFIRMATION_REQUIRED) return null;
  const meta = (error as ApiError).response?.data?.meta;
  if (typeof meta !== "object" || meta === null) return null;
  const candidate = meta as Partial<ScheduleBuildTemplateConfirmationMeta>;
  if (
    !Array.isArray(candidate.schedules) ||
    typeof candidate.summary !== "object" ||
    candidate.summary === null ||
    typeof candidate.hasDestructiveConsequences !== "boolean" ||
    !candidate.schedules.every(
      (schedule) =>
        typeof schedule === "object" &&
        schedule !== null &&
        typeof schedule.scheduleId === "number" &&
        typeof schedule.scheduleTitle === "string" &&
        actions.includes(schedule.action),
    )
  ) {
    return null;
  }
  return candidate as ScheduleBuildTemplateConfirmationMeta;
}

export function getScheduleActionMessage(action: ScheduleBuildTemplateScheduleAction): string {
  switch (action) {
    case "RESET_PREFERENCE_COLLECTION":
      return "Пожелания сотрудников станут недействительными и будут удалены. График вернётся в черновик; сбор пожеланий потребуется открыть заново.";
    case "INVALIDATE_APPLIED_AUTO_BUILD":
      return "Ранее применённый результат автосборки будет сброшен и потребуется повторная сборка. Пожелания сотрудников сохранятся.";
    case "KEEP_PREFERENCES":
      return "Пожелания сотрудников сохранятся и останутся доступными для дальнейшей работы.";
    case "PUBLISHED_UNCHANGED":
      return "Опубликованный график останется без изменений.";
    case "NO_ACTION":
      return "График останется без изменений.";
  }
}
