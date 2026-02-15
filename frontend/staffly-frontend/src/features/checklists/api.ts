import api from "../../shared/api/apiClient";

export type ChecklistPositionDto = {
  id: number;
  name: string;
};

export type ChecklistMemberShortDto = {
  id: number;
  name: string;
};

export type ChecklistItemDto = {
  id: number;
  text: string;
  done: boolean;
  doneBy?: ChecklistMemberShortDto | null;
  doneAt?: string | null;
  reservedBy?: ChecklistMemberShortDto | null;
  reservedAt?: string | null;
};

export type ChecklistKind = "INFO" | "TRACKABLE";
export type ChecklistPeriodicity = "DAILY" | "WEEKLY" | "MONTHLY" | "MANUAL";

export type ChecklistDto = {
  id: number;
  restaurantId: number;
  name: string;
  content: string;
  kind: ChecklistKind;
  periodicity?: ChecklistPeriodicity;
  completed: boolean;
  periodLabel?: string | null;
  resetTime?: string | null;
  resetDayOfWeek?: number | null;
  resetDayOfMonth?: number | null;
  items: ChecklistItemDto[];
  positions: ChecklistPositionDto[];
};

export type ChecklistRequest = {
  name: string;
  content?: string;
  kind: ChecklistKind;
  periodicity?: ChecklistPeriodicity;
  resetTime?: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  items?: string[];
  positionIds: number[];
};

export type ListChecklistsParams = {
  positionId?: number;
  kind?: ChecklistKind;
  q?: string;
};

function buildListChecklistsQuery(params?: ListChecklistsParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params?.positionId) {
    query.positionId = params.positionId;
  }
  if (params?.kind) {
    query.kind = params.kind;
  }
  const normalizedQuery = params?.q?.trim();
  if (normalizedQuery) {
    query.q = normalizedQuery;
  }
  return query;
}

export async function listChecklists(
  restaurantId: number,
  params?: ListChecklistsParams,
  signal?: AbortSignal
): Promise<ChecklistDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/checklists`, {
    params: buildListChecklistsQuery(params),
    signal,
  });
  return data as ChecklistDto[];
}

export async function createChecklist(
  restaurantId: number,
  payload: ChecklistRequest
): Promise<ChecklistDto> {
  const body = {
    name: payload.name.trim(),
    content: payload.content,
    kind: payload.kind,
    periodicity: payload.periodicity,
    resetTime: payload.resetTime,
    resetDayOfWeek: payload.resetDayOfWeek,
    resetDayOfMonth: payload.resetDayOfMonth,
    items: payload.items,
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
    kind: payload.kind,
    periodicity: payload.periodicity,
    resetTime: payload.resetTime,
    resetDayOfWeek: payload.resetDayOfWeek,
    resetDayOfMonth: payload.resetDayOfMonth,
    items: payload.items,
    positionIds: payload.positionIds,
  };
  const { data } = await api.put(`/api/restaurants/${restaurantId}/checklists/${checklistId}`, body);
  return data as ChecklistDto;
}

export async function deleteChecklist(restaurantId: number, checklistId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/checklists/${checklistId}`);
}

export async function reserveChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number
): Promise<ChecklistDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/reserve`
  );
  return data as ChecklistDto;
}

export async function unreserveChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number
): Promise<ChecklistDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/unreserve`
  );
  return data as ChecklistDto;
}

export async function completeChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number
): Promise<ChecklistDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/complete`
  );
  return data as ChecklistDto;
}

export async function undoChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number
): Promise<ChecklistDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/undo`
  );
  return data as ChecklistDto;
}

export async function resetChecklist(
  restaurantId: number,
  checklistId: number
): Promise<ChecklistDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/checklists/${checklistId}/reset`);
  return data as ChecklistDto;
}
