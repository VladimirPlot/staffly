import type { ScheduleStatus } from "../types";

const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  DRAFT: "Черновик",
  COLLECTING_PREFERENCES: "Сбор пожеланий",
  PREFERENCES_CLOSED: "Пожелания собраны",
  DRAFT_FROM_PREFERENCES: "Черновик после пожеланий",
  PUBLISHED: "Опубликован",
};

export function getScheduleStatusLabel(status?: ScheduleStatus): string {
  return status ? SCHEDULE_STATUS_LABELS[status] : "Не сохранён";
}

export function isDraftSchedule(status?: ScheduleStatus): boolean {
  return status === "DRAFT";
}

export function isCollectingPreferences(status?: ScheduleStatus): boolean {
  return status === "COLLECTING_PREFERENCES";
}

export function canPublishSchedule(status?: ScheduleStatus): boolean {
  return status === "DRAFT" || status === "DRAFT_FROM_PREFERENCES";
}

export function canApplySchedulePreferences(status?: ScheduleStatus): boolean {
  return status === "PREFERENCES_CLOSED";
}

export function canEditScheduleContent(status?: ScheduleStatus): boolean {
  return status !== "COLLECTING_PREFERENCES" && status !== "PREFERENCES_CLOSED";
}

export function canViewSchedulePreferences(status?: ScheduleStatus): boolean {
  return status === "COLLECTING_PREFERENCES" || status === "PREFERENCES_CLOSED" || status === "DRAFT_FROM_PREFERENCES";
}

export function canShowPreferenceHints(status?: ScheduleStatus): boolean {
  return status === "DRAFT_FROM_PREFERENCES";
}
