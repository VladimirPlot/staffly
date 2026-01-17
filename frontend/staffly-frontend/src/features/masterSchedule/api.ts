import api from "../../shared/api/apiClient";
import type {
  MasterScheduleCellUpdatePayload,
  MasterScheduleCopyDayPayload,
  MasterScheduleCopyWeekPayload,
  MasterScheduleCreatePayload,
  MasterScheduleDto,
  MasterScheduleRowCreatePayload,
  MasterScheduleRowDto,
  MasterScheduleRowUpdatePayload,
  MasterScheduleSummaryDto,
  MasterScheduleUpdatePayload,
} from "./types";

export async function listMasterSchedules(
  restaurantId: number
): Promise<MasterScheduleSummaryDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/master-schedules`);
  return data as MasterScheduleSummaryDto[];
}

export async function createMasterSchedule(
  restaurantId: number,
  payload: MasterScheduleCreatePayload
): Promise<MasterScheduleDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/master-schedules`, payload);
  return data as MasterScheduleDto;
}

export async function getMasterSchedule(
  restaurantId: number,
  id: number
): Promise<MasterScheduleDto> {
  const { data } = await api.get(`/api/master-schedules/${id}`, {
    params: { restaurantId },
  });
  return data as MasterScheduleDto;
}

export async function updateMasterSchedule(
  restaurantId: number,
  id: number,
  payload: MasterScheduleUpdatePayload
): Promise<MasterScheduleDto> {
  const { data } = await api.patch(`/api/master-schedules/${id}`, payload, {
    params: { restaurantId },
  });
  return data as MasterScheduleDto;
}

export async function deleteMasterSchedule(restaurantId: number, id: number): Promise<void> {
  await api.delete(`/api/master-schedules/${id}`, { params: { restaurantId } });
}

export async function createMasterScheduleRow(
  restaurantId: number,
  scheduleId: number,
  payload: MasterScheduleRowCreatePayload
): Promise<MasterScheduleRowDto> {
  const { data } = await api.post(`/api/master-schedules/${scheduleId}/rows`, payload, {
    params: { restaurantId },
  });
  return data as MasterScheduleRowDto;
}

export async function updateMasterScheduleRow(
  restaurantId: number,
  rowId: number,
  payload: MasterScheduleRowUpdatePayload
): Promise<MasterScheduleRowDto> {
  const { data } = await api.patch(`/api/master-schedules/rows/${rowId}`, payload, {
    params: { restaurantId },
  });
  return data as MasterScheduleRowDto;
}

export async function deleteMasterScheduleRow(
  restaurantId: number,
  rowId: number
): Promise<void> {
  await api.delete(`/api/master-schedules/rows/${rowId}`, { params: { restaurantId } });
}

export async function batchUpdateMasterScheduleCells(
  restaurantId: number,
  scheduleId: number,
  items: MasterScheduleCellUpdatePayload[]
): Promise<void> {
  await api.patch(
    `/api/master-schedules/${scheduleId}/cells:batch`,
    { items },
    { params: { restaurantId } }
  );
}

export async function copyMasterScheduleDay(
  restaurantId: number,
  scheduleId: number,
  payload: MasterScheduleCopyDayPayload
): Promise<void> {
  await api.post(`/api/master-schedules/${scheduleId}/copy-day`, payload, {
    params: { restaurantId },
  });
}

export async function copyMasterScheduleWeek(
  restaurantId: number,
  scheduleId: number,
  payload: MasterScheduleCopyWeekPayload
): Promise<void> {
  await api.post(`/api/master-schedules/${scheduleId}/copy-week`, payload, {
    params: { restaurantId },
  });
}
