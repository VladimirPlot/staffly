import type { ReminderDto } from "./api";

export const DETACHED_REMINDER_MESSAGE = "Сотрудник больше не работает. Напоминание отключено.";

export function isDetachedReminder(reminder: Pick<ReminderDto, "targetType" | "targetMember">): boolean {
  return reminder.targetType === "MEMBER" && !reminder.targetMember;
}
