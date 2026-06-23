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
  examplePhotoUrl?: string | null;
  completionPhotoUrl?: string | null;
  completionPhotoMode?: ChecklistPhotoMode | null;
  completionPhotoRequired: boolean;
  completionPhotoUploadedBy?: ChecklistMemberShortDto | null;
  completionPhotoUploadedAt?: string | null;
};

export type ChecklistKind = "INFO" | "TRACKABLE";
export type ChecklistPeriodicity = "DAILY" | "WEEKLY" | "MONTHLY" | "MANUAL";
export type ChecklistPhotoMode = "NONE" | "OPTIONAL" | "REQUIRED";

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
  itemDetails?: ChecklistItemRequest[];
  positionIds: number[];
};

export type ChecklistItemRequest = {
  id?: number;
  text: string;
  completionPhotoMode: ChecklistPhotoMode;
  completionPhotoRequired: boolean;
};

export type ChecklistHistorySummaryDto = {
  id: number;
  checklistId?: number | null;
  checklistName: string;
  resetAt?: string | null;
  resetReason?: "AUTO" | "MANUAL" | string | null;
  completed: boolean;
  totalItems: number;
  completedItems: number;
  positionsSnapshot?: string | null;
};

export type ChecklistHistoryItemDto = {
  id: number;
  sourceItemId?: number | null;
  itemOrder: number;
  text: string;
  done: boolean;
  doneBy?: ChecklistMemberShortDto | null;
  doneByName?: string | null;
  doneAt?: string | null;
  reservedBy?: ChecklistMemberShortDto | null;
  reservedByName?: string | null;
  reservedAt?: string | null;
  completionPhotoMode?: ChecklistPhotoMode | string | null;
  completionPhotoRequired: boolean;
  examplePhotoUrl?: string | null;
  completionPhotoUrl?: string | null;
};

export type ChecklistHistoryDetailDto = ChecklistHistorySummaryDto & {
  kind?: ChecklistKind | string | null;
  periodicity?: ChecklistPeriodicity | string | null;
  resetTime?: string | null;
  resetDayOfWeek?: number | null;
  resetDayOfMonth?: number | null;
  startedAt?: string | null;
  items: ChecklistHistoryItemDto[];
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
  signal?: AbortSignal,
): Promise<ChecklistDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/checklists`, {
    params: buildListChecklistsQuery(params),
    signal,
  });
  return data as ChecklistDto[];
}

export async function createChecklist(restaurantId: number, payload: ChecklistRequest): Promise<ChecklistDto> {
  const body = {
    name: payload.name.trim(),
    content: payload.content,
    kind: payload.kind,
    periodicity: payload.periodicity,
    resetTime: payload.resetTime,
    resetDayOfWeek: payload.resetDayOfWeek,
    resetDayOfMonth: payload.resetDayOfMonth,
    items: payload.items,
    itemDetails: payload.itemDetails,
    positionIds: payload.positionIds,
  };
  const { data } = await api.post(`/api/restaurants/${restaurantId}/checklists`, body);
  return data as ChecklistDto;
}

export async function updateChecklist(
  restaurantId: number,
  checklistId: number,
  payload: ChecklistRequest,
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
    itemDetails: payload.itemDetails,
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
  itemId: number,
): Promise<ChecklistDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/reserve`);
  return data as ChecklistDto;
}

export async function unreserveChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number,
): Promise<ChecklistDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/unreserve`,
  );
  return data as ChecklistDto;
}

export async function completeChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number,
): Promise<ChecklistDto> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/complete`,
  );
  return data as ChecklistDto;
}

export async function undoChecklistItem(
  restaurantId: number,
  checklistId: number,
  itemId: number,
): Promise<ChecklistDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/undo`);
  return data as ChecklistDto;
}

export async function resetChecklist(restaurantId: number, checklistId: number): Promise<ChecklistDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/checklists/${checklistId}/reset`);
  return data as ChecklistDto;
}

export async function uploadChecklistItemExamplePhoto(
  restaurantId: number,
  checklistId: number,
  itemId: number,
  file: File,
): Promise<ChecklistDto> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/example-photo`,
    formData,
  );
  return data as ChecklistDto;
}

export async function deleteChecklistItemExamplePhoto(
  restaurantId: number,
  checklistId: number,
  itemId: number,
): Promise<ChecklistDto> {
  const { data } = await api.delete(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/example-photo`,
  );
  return data as ChecklistDto;
}

export async function uploadChecklistItemCompletionPhoto(
  restaurantId: number,
  checklistId: number,
  itemId: number,
  file: File,
): Promise<ChecklistDto> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/completion-photo`,
    formData,
  );
  return data as ChecklistDto;
}

export async function deleteChecklistItemCompletionPhoto(
  restaurantId: number,
  checklistId: number,
  itemId: number,
): Promise<ChecklistDto> {
  const { data } = await api.delete(
    `/api/restaurants/${restaurantId}/checklists/${checklistId}/items/${itemId}/completion-photo`,
  );
  return data as ChecklistDto;
}

export async function listChecklistHistory(
  restaurantId: number,
  checklistId: number,
): Promise<ChecklistHistorySummaryDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/checklists/${checklistId}/history`);
  return data as ChecklistHistorySummaryDto[];
}

export async function getChecklistHistory(restaurantId: number, historyId: number): Promise<ChecklistHistoryDetailDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/checklists/history/${historyId}`);
  return data as ChecklistHistoryDetailDto;
}
