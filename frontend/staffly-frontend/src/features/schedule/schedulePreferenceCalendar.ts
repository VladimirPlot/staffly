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

export function toggleSelectedDay(selectedDays: ReadonlySet<string>, day: string): Set<string> {
  const next = new Set(selectedDays);
  if (next.has(day)) next.delete(day);
  else next.add(day);
  return next;
}

export function addDayDuringDrag(
  selectedDays: ReadonlySet<string>,
  visitedDays: Set<string>,
  day: string,
): Set<string> {
  if (visitedDays.has(day)) return new Set(selectedDays);
  visitedDays.add(day);
  const next = new Set(selectedDays);
  next.add(day);
  return next;
}

export function normalizePreferenceEdit(edit: PreferenceDayDraft): PreferenceDayDraft {
  if (edit.type === "NO_PREFERENCE") {
    return { type: "NO_PREFERENCE", fullDay: true, startTime: "", endTime: "", note: "" };
  }
  if (edit.type === "UNAVAILABLE" || edit.type === "PREFER_DAY_OFF") {
    return { ...edit, fullDay: true, startTime: "", endTime: "" };
  }
  return { ...edit };
}

export function applyPreferenceToSelectedDays(
  state: Record<string, PreferenceDayDraft>,
  selectedDays: ReadonlySet<string>,
  edit: PreferenceDayDraft,
): Record<string, PreferenceDayDraft> {
  const normalized = normalizePreferenceEdit(edit);
  const next = { ...state };
  selectedDays.forEach((day) => {
    if (Object.prototype.hasOwnProperty.call(state, day)) next[day] = { ...normalized };
  });
  return next;
}
