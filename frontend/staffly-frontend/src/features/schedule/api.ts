import api from "../../shared/api/apiClient";
import type { ScheduleConfig, ScheduleData } from "./types";

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

export async function saveSchedule(restaurantId: number, payload: SaveSchedulePayload): Promise<ScheduleData> {
  const { data } = await api.post<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules`, payload);
  return mapSchedule(data);
}

export async function listSavedSchedules(restaurantId: number): Promise<ScheduleSummary[]> {
  const { data } = await api.get<ScheduleSummary[]>(`/api/restaurants/${restaurantId}/schedules`);
  return data;
}

export async function fetchSchedule(restaurantId: number, scheduleId: number): Promise<ScheduleData> {
  const { data } = await api.get<ScheduleResponse>(`/api/restaurants/${restaurantId}/schedules/${scheduleId}`);
  return mapSchedule(data);
}
