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

export async function listFolders(restaurantId: number, type: TrainingFolderType): Promise<TrainingFolderDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/training/folders`, { params: { type } });
  return data as TrainingFolderDto[];
}

export async function listExams(restaurantId: number): Promise<TrainingExamDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/training/exams`);
  return data as TrainingExamDto[];
}
