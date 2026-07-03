import type { MemberDto } from "../employees/api";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type ShiftMode = "ARRIVAL_ONLY" | "FULL" | "NONE";

export type ScheduleCellSource = "MANUAL" | "PREFERENCE_HINT" | "AUTO_BUILD";

export type ScheduleCellChangeOptions = {
  commit?: boolean;
  source?: ScheduleCellSource;
};

export type ScheduleStatus =
  | "DRAFT"
  | "COLLECTING_PREFERENCES"
  | "PREFERENCES_CLOSED"
  | "DRAFT_FROM_PREFERENCES"
  | "PUBLISHED";

export type ScheduleLifecycleFields = {
  status: ScheduleStatus;
  preferenceCollectionStartedAt?: string | null;
  preferenceDeadline?: string | null;
  preferenceClosedAt?: string | null;
  preferenceAppliedAt?: string | null;
  preferenceBuildTemplateId?: number | null;
};

export type ScheduleConfig = {
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  positionIds: number[];
  showFullName: boolean;
  shiftMode: ShiftMode;
};

export type ScheduleOwnerDto = {
  userId: number | null;
  memberId: number | null;
  displayName: string | null;
  role: RestaurantRole | string;
  positionName: string | null;
};

export type ScheduleCreatedByDto = {
  userId: number | null;
  displayName: string | null;
};

export type ScheduleAuditLogDto = {
  id: number;
  action: string;
  actorUserId: number | null;
  actorDisplayName: string | null;
  details: string | null;
  createdAt: string;
};

export type ScheduleDay = {
  date: string; // ISO yyyy-mm-dd
  weekdayLabel: string;
  dayNumber: string;
};

export type ScheduleRow = {
  id?: number;
  memberId: number;
  member?: MemberDto;
  displayName: string;
  positionId: number | null | undefined;
  positionName: string | null;
};

export type ScheduleData = {
  id?: number;
  status?: ScheduleStatus;
  preferenceCollectionStartedAt?: string | null;
  preferenceDeadline?: string | null;
  preferenceClosedAt?: string | null;
  preferenceAppliedAt?: string | null;
  preferenceBuildTemplateId?: number | null;
  title: string;
  config: ScheduleConfig;
  days: ScheduleDay[];
  rows: ScheduleRow[];
  cellValues: Record<string, string>;
  cellSources?: Record<string, ScheduleCellSource>;
  owner?: ScheduleOwnerDto | null;
  createdBy?: ScheduleCreatedByDto | null;
  history?: ScheduleAuditLogDto[];
};

export type ScheduleCellKey = `${number}:${string}`;

export type SchedulePreferenceHintsByCellKey = Record<string, import("./api").SchedulePreferenceCellDto[]>;

export type ScheduleRejectionHintsByCellKey = Record<string, import("./api").ScheduleAutoBuildRejectionHintDto[]>;
