import type { SchedulePreferenceCellRequest, SchedulePreferenceMyResponse, SchedulePreferenceType } from "./api";

export const SCHEDULE_PREFERENCE_DRAFT_SCHEMA_VERSION = 1 as const;

export type PreferenceDayDraft = {
  type: "NO_PREFERENCE" | SchedulePreferenceType;
  fullDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
};

export type SchedulePreferenceEditableState = {
  cellsByDay: Record<string, PreferenceDayDraft>;
  periodComment: string;
};

export type SchedulePreferenceDraft = SchedulePreferenceEditableState & {
  schemaVersion: typeof SCHEDULE_PREFERENCE_DRAFT_SCHEMA_VERSION;
  baseRevision: number;
  savedAt: string;
};

export type SchedulePreferenceDraftIdentity = {
  restaurantId: number;
  memberId: number;
  scheduleId: number;
  preferenceCollectionCycle: number;
};

export type SchedulePreferenceDraftResolutionReason =
  | "NO_DRAFT"
  | "RESTORED"
  | "REVISION_MISMATCH"
  | "COLLECTION_CLOSED";

export type SchedulePreferenceDraftResolution = {
  editableState: SchedulePreferenceEditableState;
  baseRevision: number;
  reason: SchedulePreferenceDraftResolutionReason;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_PREFIX = "staffly:schedule-preference-draft:v1";
const PREFERENCE_TYPES = new Set(["NO_PREFERENCE", "AVAILABLE", "UNAVAILABLE", "PREFER_DAY_OFF"]);

export function buildSchedulePreferenceDraftKey(identity: SchedulePreferenceDraftIdentity): string {
  return [
    STORAGE_PREFIX,
    identity.restaurantId,
    identity.memberId,
    identity.scheduleId,
    identity.preferenceCollectionCycle,
  ].join(":");
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isDayDraft(value: unknown): value is PreferenceDayDraft {
  if (!value || typeof value !== "object") return false;
  const cell = value as Record<string, unknown>;
  return (
    typeof cell.type === "string" &&
    PREFERENCE_TYPES.has(cell.type) &&
    typeof cell.fullDay === "boolean" &&
    typeof cell.startTime === "string" &&
    typeof cell.endTime === "string" &&
    typeof cell.note === "string"
  );
}

export function parseSchedulePreferenceDraft(value: unknown): SchedulePreferenceDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  if (
    draft.schemaVersion !== SCHEDULE_PREFERENCE_DRAFT_SCHEMA_VERSION ||
    !Number.isSafeInteger(draft.baseRevision) ||
    (draft.baseRevision as number) < 0 ||
    typeof draft.savedAt !== "string" ||
    Number.isNaN(Date.parse(draft.savedAt)) ||
    typeof draft.periodComment !== "string" ||
    !draft.cellsByDay ||
    typeof draft.cellsByDay !== "object" ||
    Array.isArray(draft.cellsByDay)
  ) {
    return null;
  }

  if (!Object.entries(draft.cellsByDay).every(([day, cell]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && isDayDraft(cell))) {
    return null;
  }
  return draft as SchedulePreferenceDraft;
}

export function readSchedulePreferenceDraft(
  identity: SchedulePreferenceDraftIdentity,
  storage: StorageLike | null = browserStorage(),
): SchedulePreferenceDraft | null {
  if (!storage) return null;
  const key = buildSchedulePreferenceDraftKey(identity);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const draft = parseSchedulePreferenceDraft(JSON.parse(raw));
    if (!draft) storage.removeItem(key);
    return draft;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable (privacy mode/quota/security policy).
    }
    return null;
  }
}

export function writeSchedulePreferenceDraft(
  identity: SchedulePreferenceDraftIdentity,
  draft: SchedulePreferenceDraft,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(buildSchedulePreferenceDraftKey(identity), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeSchedulePreferenceDraft(
  identity: SchedulePreferenceDraftIdentity,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(buildSchedulePreferenceDraftKey(identity));
    return true;
  } catch {
    return false;
  }
}

export function canAutosaveSchedulePreferenceDraft(
  hydrated: boolean,
  hasLocalEdits: boolean,
  identity: SchedulePreferenceDraftIdentity | null,
  baseRevision: number | null,
): identity is SchedulePreferenceDraftIdentity {
  return hydrated && hasLocalEdits && identity !== null && baseRevision !== null;
}

export function editableStateFromResponse(data: SchedulePreferenceMyResponse): SchedulePreferenceEditableState {
  const cells = new Map(data.cells.map((cell) => [cell.day, cell]));
  const cellsByDay: Record<string, PreferenceDayDraft> = {};
  data.days.forEach(({ date }) => {
    const cell = cells.get(date);
    cellsByDay[date] = cell
      ? {
          type: cell.type,
          fullDay: cell.fullDay,
          startTime: cell.fullDay ? "" : normalizeTime(cell.startTime),
          endTime: cell.fullDay ? "" : normalizeTime(cell.endTime),
          note: cell.note ?? "",
        }
      : { type: "NO_PREFERENCE", fullDay: true, startTime: "", endTime: "", note: "" };
  });
  return { cellsByDay, periodComment: data.periodComment ?? "" };
}

export function resolveSchedulePreferenceDraft(
  data: SchedulePreferenceMyResponse,
  draft: SchedulePreferenceDraft | null,
): SchedulePreferenceDraftResolution {
  const serverState = editableStateFromResponse(data);
  if (!draft) return { editableState: serverState, baseRevision: data.revision, reason: "NO_DRAFT" };
  if (!data.canSubmit) {
    return { editableState: serverState, baseRevision: data.revision, reason: "COLLECTION_CLOSED" };
  }
  if (draft.baseRevision !== data.revision) {
    return { editableState: serverState, baseRevision: data.revision, reason: "REVISION_MISMATCH" };
  }
  return {
    editableState: { cellsByDay: draft.cellsByDay, periodComment: draft.periodComment },
    baseRevision: draft.baseRevision,
    reason: "RESTORED",
  };
}

export function buildPreferenceCellsRequest(
  days: SchedulePreferenceMyResponse["days"],
  cellsByDay: Record<string, PreferenceDayDraft>,
): SchedulePreferenceCellRequest[] {
  return days.flatMap(({ date }) => {
    const value = cellsByDay[date];
    if (!value || value.type === "NO_PREFERENCE") return [];
    return [
      {
        day: date,
        type: value.type,
        fullDay: value.fullDay,
        startTime: value.fullDay ? null : value.startTime,
        endTime: value.fullDay ? null : value.endTime,
        note: value.note.trim() || null,
      },
    ];
  });
}

function normalizeTime(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  return match ? `${match[1]}:${match[2]}` : value;
}
