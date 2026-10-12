import api from "../../shared/api/apiClient";
import type { ScheduleData } from "../schedule/types";

export type CommonScheduleSummary = {
  id: number;
  version: number;
  title: string;
  startDate: string;
  endDate: string;
  visibleToPositions: boolean;
  scheduleIds: number[];
};

export type CommonScheduleSource = {
  id: number;
  version: number;
  title: string;
  content: Pick<ScheduleData, "config" | "days" | "rows" | "cellValues" | "cellSources" | "cellShifts">;
};

export type CommonSchedule = { summary: CommonScheduleSummary; sources: CommonScheduleSource[] };
export type CommonSchedulePayload = {
  title: string;
  scheduleIds: number[];
  visibleToPositions: boolean;
  version?: number;
};

const path = (restaurantId: number) => `/api/restaurants/${restaurantId}/common-schedules`;

export async function listCommonSchedules(restaurantId: number, signal?: AbortSignal) {
  return (await api.get<CommonScheduleSummary[]>(path(restaurantId), { signal })).data;
}

export async function getCommonSchedule(restaurantId: number, id: number, signal?: AbortSignal) {
  return (await api.get<CommonSchedule>(`${path(restaurantId)}/${id}`, { signal })).data;
}

export async function saveCommonSchedule(restaurantId: number, payload: CommonSchedulePayload, id?: number) {
  return id == null
    ? (await api.post<CommonSchedule>(path(restaurantId), payload)).data
    : (await api.put<CommonSchedule>(`${path(restaurantId)}/${id}`, payload)).data;
}

export async function deleteCommonSchedule(restaurantId: number, summary: CommonScheduleSummary) {
  await api.delete(`${path(restaurantId)}/${summary.id}`, { params: { version: summary.version } });
}
