import type { MemberDto } from "../employees/api";

export type ShiftMode = "ARRIVAL_ONLY" | "FULL" | "NONE";

export type ScheduleConfig = {
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  positionIds: number[];
  showFullName: boolean;
  shiftMode: ShiftMode;
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
};

export type ScheduleCellKey = `${number}:${string}`;
