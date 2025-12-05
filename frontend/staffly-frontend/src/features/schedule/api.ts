import api from "../../shared/api/apiClient";
import type { ScheduleConfig, ScheduleData } from "./types";

export type ShiftRequestType = "REPLACEMENT" | "SWAP";
export type ShiftRequestStatus =
  | "PENDING_TARGET"
  | "PENDING_MANAGER"
  | "APPROVED"
  | "REJECTED_BY_TARGET"
  | "REJECTED_BY_MANAGER"
  | "CANCELLED";

export type ShiftRequestMemberDto = {
  id: number;
  displayName: string;
  positionName: string | null;
};

export type ShiftRequestDto = {
  id: number;
  type: ShiftRequestType;
  dayFrom: string;
  dayTo: string | null;
  status: ShiftRequestStatus;
  reason: string | null;
  createdAt: string;
  fromMember: ShiftRequestMemberDto;
  toMember: ShiftRequestMemberDto;
};

export type ScheduleSummary = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: string;
};

type ScheduleRowResponse = {
  id: number;
  memberId: number;
  displayName: string;
  positionId: number | null;
  positionName: string | null;
};

type ScheduleResponse = {
  id: number;
  title: string;
  config: ScheduleConfig;
  days: ScheduleData["days"];
  rows: ScheduleRowResponse[];
  cellValues: Record<string, string>;
};

export type SaveSchedulePayload = {
  title: string;
  config: ScheduleConfig;
  rows: {
    memberId: number;
    displayName: string;
    positionId: number | null;
    positionName: string | null;
  }[];
  cellValues: Record<string, string>;
};

function mapSchedule(data: ScheduleResponse): ScheduleData {
  return {
    id: data.id,
    title: data.title,
    config: data.config,
    days: data.days,
    rows: data.rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      displayName: row.displayName,
      positionId: row.positionId,
      positionName: row.positionName,
    })),
    cellValues: data.cellValues,
  };
}

export async function createSchedule(
  restaurantId: number,
  payload: SaveSchedulePayload
): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules`, payload);
  return mapSchedule(data);
}

export async function updateSchedule(
  restaurantId: number,
  scheduleId: number,
  payload: SaveSchedulePayload
): Promise<ScheduleData> {
  const { data } = await api.put<ScheduleResponse>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}`,
    payload
  );
  return mapSchedule(data);
}

export async function deleteSchedule(restaurantId: number, scheduleId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/schedules/${scheduleId}`);
}

export async function listSavedSchedules(restaurantId: number): Promise<ScheduleSummary[]> {
  const { data } = await api.get<ScheduleSummary[]>(`/api/restaurants/${restaurantId}/schedules`);
  return data;
}

export async function fetchSchedule(restaurantId: number, scheduleId: number): Promise<ScheduleData> {
  const { data } = await api.get<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/${scheduleId}`);
  return mapSchedule(data);
}

export async function createReplacement(
  restaurantId: number,
  scheduleId: number,
  payload: { day: string; toMemberId: number; reason?: string }
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/replacement`,
    payload
  );
  return data;
}

export async function createSwap(
  restaurantId: number,
  scheduleId: number,
  payload: { myDay: string; targetMemberId: number; targetDay: string; reason?: string }
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/swap`,
    payload
  );
  return data;
}

export async function listShiftRequests(
  restaurantId: number,
  scheduleId: number
): Promise<ShiftRequestDto[]> {
  const { data } = await api.get<ShiftRequestDto[]>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests`
  );
  return data;
}

export async function decideAsTarget(
  restaurantId: number,
  scheduleId: number,
  requestId: number,
  accepted: boolean
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/${requestId}/target-decision`,
    { accepted }
  );
  return data;
}

export async function decideAsManager(
  restaurantId: number,
  scheduleId: number,
  requestId: number,
  accepted: boolean
): Promise<ShiftRequestDto> {
  const { data } = await api.post<ShiftRequestDto>(
    `/api/restaurants/${restaurantId}/schedules/${scheduleId}/shift-requests/${requestId}/manager-decision`,
    { accepted }
  );
  return data;
}
