import api from "../../shared/api/apiClient";
import type {
  MasterScheduleApplyTemplatePayload,
  MasterScheduleCellDto,
  MasterScheduleCellUpdatePayload,
  MasterScheduleCreatePayload,
  MasterScheduleDto,
  MasterScheduleRowCreatePayload,
  MasterScheduleRowDto,
  MasterScheduleRowUpdatePayload,
  MasterScheduleSummaryDto,
  MasterScheduleUpdatePayload,
  MasterScheduleWeekTemplateCellDto,
  MasterScheduleWeekTemplatePositionPayload,
  MasterScheduleWeekTemplateUpdatePayload,
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
  const { data } = await api.get(
    `/api/restaurants/${restaurantId}/master-schedules/${id}`
  );
  return data as MasterScheduleDto;
}

export async function updateMasterSchedule(
  restaurantId: number,
  id: number,
  payload: MasterScheduleUpdatePayload
): Promise<MasterScheduleDto> {
  const { data } = await api.patch(
    `/api/restaurants/${restaurantId}/master-schedules/${id}`,
    payload
  );
  return data as MasterScheduleDto;
}

export async function deleteMasterSchedule(restaurantId: number, id: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/master-schedules/${id}`);
}

export async function createMasterScheduleRow(
  restaurantId: number,
  scheduleId: number,
  payload: MasterScheduleRowCreatePayload
): Promise<MasterScheduleRowDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/rows`,
    payload
  );
  return data as MasterScheduleRowDto;
}

export async function updateMasterScheduleRow(
  restaurantId: number,
  scheduleId: number,
  rowId: number,
  payload: MasterScheduleRowUpdatePayload
): Promise<MasterScheduleRowDto> {
  const { data } = await api.patch(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/rows/${rowId}`,
    payload
  );
  return data as MasterScheduleRowDto;
}

export async function deleteMasterScheduleRow(
  restaurantId: number,
  scheduleId: number,
  rowId: number
): Promise<void> {
  await api.delete(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/rows/${rowId}`
  );
}

export async function batchUpdateMasterScheduleCells(
  restaurantId: number,
  scheduleId: number,
  items: MasterScheduleCellUpdatePayload[]
): Promise<MasterScheduleCellDto[]> {
  const { data } = await api.patch(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/cells:batch`,
    { items }
  );
  return data as MasterScheduleCellDto[];
}

export async function getMasterScheduleWeekTemplate(
  restaurantId: number,
  scheduleId: number
): Promise<MasterScheduleWeekTemplateCellDto[]> {
  const { data } = await api.get(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/week-template`
  );
  return data as MasterScheduleWeekTemplateCellDto[];
}

export async function updateMasterScheduleWeekTemplate(
  restaurantId: number,
  scheduleId: number,
  items: MasterScheduleWeekTemplateUpdatePayload[]
): Promise<MasterScheduleWeekTemplateCellDto[]> {
  const { data } = await api.patch(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/week-template:batch`,
    { items }
  );
  return data as MasterScheduleWeekTemplateCellDto[];
}

export async function addMasterScheduleWeekTemplatePosition(
  restaurantId: number,
  scheduleId: number,
  payload: MasterScheduleWeekTemplatePositionPayload
): Promise<MasterScheduleWeekTemplateCellDto[]> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/week-template/positions`,
    payload
  );
  return data as MasterScheduleWeekTemplateCellDto[];
}

export async function deleteMasterScheduleWeekTemplatePosition(
  restaurantId: number,
  scheduleId: number,
  positionId: number
): Promise<void> {
  await api.delete(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/week-template/positions/${positionId}`
  );
}

export async function applyMasterScheduleWeekTemplate(
  restaurantId: number,
  scheduleId: number,
  payload: MasterScheduleApplyTemplatePayload
): Promise<void> {
  await api.post(
    `/api/restaurants/${restaurantId}/master-schedules/${scheduleId}/week-template/apply`,
    payload
  );
}
