import api from "../../shared/api/apiClient";

export type TrainingFolderType = "KNOWLEDGE" | "QUESTION_BANK";

export type TrainingFolderDto = {
  id: number;
  restaurantId: number;
  parentId: number | null;
  name: string;
  description?: string | null;
  type: TrainingFolderType;
  sortOrder: number;
  active: boolean;
};

export type TrainingExamDto = {
  id: number;
  restaurantId: number;
  title: string;
  description?: string | null;
  questionCount: number;
  passPercent: number;
  timeLimitSec?: number | null;
  active: boolean;
  folderIds: number[];
};

export async function listFolders(restaurantId: number, type: TrainingFolderType, includeInactive = false): Promise<TrainingFolderDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/training/folders`, { params: { type, includeInactive } });
  return data as TrainingFolderDto[];
}

export async function hideFolder(restaurantId: number, folderId: number): Promise<TrainingFolderDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/training/folders/${folderId}/hide`);
  return data as TrainingFolderDto;
}

export async function restoreFolder(restaurantId: number, folderId: number): Promise<TrainingFolderDto> {
  const { data } = await api.patch(`/api/restaurants/${restaurantId}/training/folders/${folderId}/restore`);
  return data as TrainingFolderDto;
}

export async function listExams(restaurantId: number, includeInactive = false): Promise<TrainingExamDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/training/exams`, { params: { includeInactive } });
  return data as TrainingExamDto[];
}
