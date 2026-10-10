import type { InvitationIntentAction, InvitationScheduleOpportunity } from "../../invitations/api";
import {
  formatInstantInTimeZone,
  instantToRestaurantLocalDateTime,
  restaurantLocalDateTimeToInstant,
} from "../../schedule/utils/date.ts";

export function actionAcceptsDeadline(action: InvitationIntentAction | undefined): boolean {
  return (
    action === "ADD_TO_COLLECTION" || action === "ADD_AND_REOPEN_COLLECTION" || action === "ADD_AND_REOPEN_FOR_REBUILD"
  );
}

export type InvitationDeadlineValidation = {
  valid: boolean;
  required: boolean;
  requestedDeadline: string | null;
  error: string | null;
  minimum: string | null;
  helper: string;
  applicationHelper: string;
};

export function deadlineValidation(
  item: Pick<InvitationScheduleOpportunity, "currentPreferenceDeadline" | "newDeadlineRequired">,
  action: InvitationIntentAction | undefined,
  localDeadline: string,
  timeZone: string,
  now = Date.now(),
): InvitationDeadlineValidation {
  const accepts = actionAcceptsDeadline(action);
  const required = accepts && item.newDeadlineRequired;
  const current = item.currentPreferenceDeadline ? Date.parse(item.currentPreferenceDeadline) : NaN;
  // The control has minute precision: round upward so its first selectable minute is valid.
  const boundary = current > now ? current : now + 1;
  const minimum = instantToRestaurantLocalDateTime(new Date(Math.ceil(boundary / 60_000) * 60_000), timeZone);
  const formattedCurrent = item.currentPreferenceDeadline
    ? formatInstantInTimeZone(item.currentPreferenceDeadline, timeZone)
    : null;
  const helper = formattedCurrent
    ? `Новый дедлайн должен быть не раньше текущего: ${formattedCurrent}. Дата и время должны быть в будущем.`
    : "Укажите будущую дату и время.";
  const applicationHelper =
    action === "ADD_AND_REOPEN_COLLECTION" || action === "ADD_AND_REOPEN_FOR_REBUILD"
      ? "После принятия приглашения сбор откроется снова до указанного времени."
      : "Новый дедлайн будет применён только после принятия приглашения.";
  const requestedDeadline = accepts && localDeadline ? restaurantLocalDateTimeToInstant(localDeadline, timeZone) : null;
  let error: string | null = null;
  if (accepts) {
    if (!localDeadline && required) error = "Укажите новый дедлайн.";
    else if (localDeadline && !requestedDeadline) error = "Не удалось распознать дату и время.";
    else if (requestedDeadline && Date.parse(requestedDeadline) <= now) error = "Дата и время должны быть в будущем.";
    else if (requestedDeadline && Date.parse(requestedDeadline) < current) {
      error = `Новый дедлайн не может быть раньше текущего — ${formattedCurrent}.`;
    }
  }
  return { valid: error === null, required, requestedDeadline, error, minimum, helper, applicationHelper };
}
