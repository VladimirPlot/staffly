import api from "../../shared/api/apiClient";

export type ChecklistPositionDto = {
  id: number;
  name: string;
};

export type ChecklistDto = {
  id: number;
  restaurantId: number;
  name: string;
  content: string;
  positions: ChecklistPositionDto[];
};

export type ChecklistRequest = {
  name: string;
  content: string;
  positionIds: number[];
};

export async function listChecklists(
  restaurantId: number,
  params?: { positionId?: number }
): Promise<ChecklistDto[]> {
  const query: Record<string, any> = {};
  if (params?.positionId) {
    query.positionId = params.positionId;
  }
  const { data } = await api.get(`/api/restaurants/${restaurantId}/checklists`, { params: query });
  return data as ChecklistDto[];
}

export async function createChecklist(
  restaurantId: number,
  payload: ChecklistRequest
): Promise<ChecklistDto> {
  const body = {
    name: payload.name.trim(),
    content: payload.content,
    positionIds: payload.positionIds,
  };
  const { data } = await api.post(`/api/restaurants/${restaurantId}/checklists`, body);
  return data as ChecklistDto;
}

export async function updateChecklist(
  restaurantId: number,
  checklistId: number,
  payload: ChecklistRequest
): Promise<ChecklistDto> {
  const body = {
    name: payload.name.trim(),
    content: payload.content,
    positionIds: payload.positionIds,
  };
  const { data } = await api.put(`/api/restaurants/${restaurantId}/checklists/${checklistId}`, body);
  return data as ChecklistDto;
}

export async function deleteChecklist(restaurantId: number, checklistId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/checklists/${checklistId}`);
}

export async function downloadChecklist(
  restaurantId: number,
  checklistId: number,
  format: "txt" | "docx"
): Promise<Blob> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/checklists/${checklistId}/download`, {
    params: { format },
    responseType: "blob",
  });
  return data as Blob;
}
