import type { MemberDto } from "../employees/api";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type ShiftMode = "ARRIVAL_ONLY" | "FULL" | "NONE";

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
  title: string;
  config: ScheduleConfig;
  days: ScheduleDay[];
  rows: ScheduleRow[];
  cellValues: Record<string, string>;
  owner?: ScheduleOwnerDto | null;
  createdBy?: ScheduleCreatedByDto | null;
  history?: ScheduleAuditLogDto[];
};

export type ScheduleCellKey = `${number}:${string}`;
