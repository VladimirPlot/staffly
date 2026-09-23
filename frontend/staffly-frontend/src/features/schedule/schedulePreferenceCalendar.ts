import type { PreferenceDayDraft } from "./schedulePreferenceDraftStorage";

export type PreferenceCalendarPresentation = {
  label: string;
  tone: "green" | "amber" | "red";
  startTime?: string;
  endTime?: string;
};

export function getPreferenceCalendarPresentation(value?: PreferenceDayDraft): PreferenceCalendarPresentation {
  const type = value?.type ?? "NO_PREFERENCE";
  if (type === "PREFER_DAY_OFF") return { label: "Выходной", tone: "amber" };
  if (type === "UNAVAILABLE") return { label: "Не могу", tone: "red" };
  if (type === "AVAILABLE") {
    if (value && !value.fullDay && value.startTime && value.endTime) {
      return { label: "Могу", tone: "green", startTime: value.startTime, endTime: value.endTime };
    }
    return { label: "Весь день", tone: "green" };
  }
  return { label: "Без пожеланий", tone: "green" };
}

export function getCalendarLeadingSlotCount(firstDay: string): number {
  const sundayBasedDay = new Date(`${firstDay}T00:00:00Z`).getUTCDay();
  return (sundayBasedDay + 6) % 7;
}

export function applyPreferenceDayEdit(
  state: Record<string, PreferenceDayDraft>,
  day: string,
  edit: PreferenceDayDraft,
): Record<string, PreferenceDayDraft> {
  return { ...state, [day]: edit };
}
