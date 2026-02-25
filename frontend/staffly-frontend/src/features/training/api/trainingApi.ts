import apiClient from "../../../shared/api/apiClient";
import type {
  CreateKnowledgeItemPayload,
  CreateQuestionPayload,
  CreateTrainingFolderPayload,
  ExamAttemptDto,
  ExamProgressDto,
  ExamResultRowDto,
  ExamSubmitPayload,
  ExamSubmitResultDto,
  TrainingExamDto,
  TrainingFolderDto,
  TrainingFolderType,
  TrainingKnowledgeItemDto,
  TrainingQuestionDto,
  UpdateKnowledgeItemPayload,
  UpdateQuestionPayload,
  UpdateTrainingFolderPayload,
  UpsertExamPayload,
} from "./types";

export async function listFolders(restaurantId: number, type: TrainingFolderType, includeInactive = false): Promise<TrainingFolderDto[]> {
  const { data } = await apiClient.get(`/api/restaurants/${restaurantId}/training/folders`, { params: { type, includeInactive } });
  return data as TrainingFolderDto[];
}
export async function createFolder(restaurantId: number, payload: CreateTrainingFolderPayload): Promise<TrainingFolderDto> { const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/folders`, payload); return data as TrainingFolderDto; }
export async function hideFolder(restaurantId: number, folderId: number): Promise<TrainingFolderDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/folders/${folderId}/hide`); return data as TrainingFolderDto; }
export async function restoreFolder(restaurantId: number, folderId: number): Promise<TrainingFolderDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/folders/${folderId}/restore`); return data as TrainingFolderDto; }
export async function updateFolder(restaurantId: number, folderId: number, payload: UpdateTrainingFolderPayload): Promise<TrainingFolderDto> { const { data } = await apiClient.put(`/api/restaurants/${restaurantId}/training/folders/${folderId}`, payload); return data as TrainingFolderDto; }
export async function deleteFolder(restaurantId: number, folderId: number): Promise<void> { await apiClient.delete(`/api/restaurants/${restaurantId}/training/folders/${folderId}`); }

export async function listKnowledgeItems(restaurantId: number, folderId?: number, includeInactive = false): Promise<TrainingKnowledgeItemDto[]> {
  const { data } = await apiClient.get(`/api/restaurants/${restaurantId}/training/knowledge-items`, { params: { folderId, includeInactive } });
  return data as TrainingKnowledgeItemDto[];
}
export async function hideKnowledgeItem(restaurantId: number, itemId: number): Promise<TrainingKnowledgeItemDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/knowledge-items/${itemId}/hide`); return data as TrainingKnowledgeItemDto; }
export async function createKnowledgeItem(restaurantId: number, payload: CreateKnowledgeItemPayload): Promise<TrainingKnowledgeItemDto> { const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/knowledge-items`, payload); return data as TrainingKnowledgeItemDto; }
export async function updateKnowledgeItem(restaurantId: number, itemId: number, payload: UpdateKnowledgeItemPayload): Promise<TrainingKnowledgeItemDto> { const { data } = await apiClient.put(`/api/restaurants/${restaurantId}/training/knowledge-items/${itemId}`, payload); return data as TrainingKnowledgeItemDto; }
export async function uploadKnowledgeImage(restaurantId: number, itemId: number, file: File): Promise<TrainingKnowledgeItemDto> {
  const formData = new FormData(); formData.append("file", file);
  const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/knowledge-items/${itemId}/image`, formData, { headers: { "Content-Type": "multipart/form-data" } });
  return data as TrainingKnowledgeItemDto;
}
export async function deleteKnowledgeImage(restaurantId: number, itemId: number): Promise<TrainingKnowledgeItemDto> { const { data } = await apiClient.delete(`/api/restaurants/${restaurantId}/training/knowledge-items/${itemId}/image`); return data as TrainingKnowledgeItemDto; }
export async function restoreKnowledgeItem(restaurantId: number, itemId: number): Promise<TrainingKnowledgeItemDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/knowledge-items/${itemId}/restore`); return data as TrainingKnowledgeItemDto; }
export async function deleteKnowledgeItem(restaurantId: number, itemId: number): Promise<void> { await apiClient.delete(`/api/restaurants/${restaurantId}/training/knowledge-items/${itemId}`); }

export async function listQuestions(restaurantId: number, folderId: number, includeInactive = false): Promise<TrainingQuestionDto[]> {
  const { data } = await apiClient.get(`/api/restaurants/${restaurantId}/training/questions`, { params: { folderId, includeInactive } });
  return data as TrainingQuestionDto[];
}
export async function createQuestion(restaurantId: number, payload: CreateQuestionPayload): Promise<TrainingQuestionDto> { const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/questions`, payload); return data as TrainingQuestionDto; }
export async function updateQuestion(restaurantId: number, questionId: number, payload: UpdateQuestionPayload): Promise<TrainingQuestionDto> { const { data } = await apiClient.put(`/api/restaurants/${restaurantId}/training/questions/${questionId}`, payload); return data as TrainingQuestionDto; }
export async function hideQuestion(restaurantId: number, questionId: number): Promise<TrainingQuestionDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/questions/${questionId}/hide`); return data as TrainingQuestionDto; }
export async function restoreQuestion(restaurantId: number, questionId: number): Promise<TrainingQuestionDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/questions/${questionId}/restore`); return data as TrainingQuestionDto; }
export async function deleteQuestion(restaurantId: number, questionId: number): Promise<void> { await apiClient.delete(`/api/restaurants/${restaurantId}/training/questions/${questionId}`); }

export async function listExams(restaurantId: number, includeInactive = false, certificationOnly?: boolean): Promise<TrainingExamDto[]> {
  const { data } = await apiClient.get(`/api/restaurants/${restaurantId}/training/exams`, { params: { includeInactive, certificationOnly } });
  return data as TrainingExamDto[];
}
export async function createExam(restaurantId: number, payload: UpsertExamPayload): Promise<TrainingExamDto> { const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/exams`, payload); return data as TrainingExamDto; }
export async function updateExam(restaurantId: number, examId: number, payload: UpsertExamPayload): Promise<TrainingExamDto> { const { data } = await apiClient.put(`/api/restaurants/${restaurantId}/training/exams/${examId}`, payload); return data as TrainingExamDto; }
export async function hideExam(restaurantId: number, examId: number): Promise<TrainingExamDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/exams/${examId}/hide`); return data as TrainingExamDto; }
export async function restoreExam(restaurantId: number, examId: number): Promise<TrainingExamDto> { const { data } = await apiClient.patch(`/api/restaurants/${restaurantId}/training/exams/${examId}/restore`); return data as TrainingExamDto; }
export async function deleteExam(restaurantId: number, examId: number): Promise<void> { await apiClient.delete(`/api/restaurants/${restaurantId}/training/exams/${examId}`); }
export async function resetExamResults(restaurantId: number, examId: number): Promise<void> { await apiClient.post(`/api/restaurants/${restaurantId}/training/exams/${examId}/reset-results`); }
export async function getExamResults(restaurantId: number, examId: number, positionId?: number): Promise<ExamResultRowDto[]> {
  const { data } = await apiClient.get(`/api/restaurants/${restaurantId}/training/exams/${examId}/results`, { params: { positionId } });
  return data as ExamResultRowDto[];
}

export async function getExamProgress(restaurantId: number): Promise<ExamProgressDto[]> { const { data } = await apiClient.get(`/api/restaurants/${restaurantId}/training/exams/progress`); return data as ExamProgressDto[]; }
export async function startExam(restaurantId: number, examId: number): Promise<ExamAttemptDto> { const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/exams/${examId}/start`); return data as ExamAttemptDto; }
export async function submitExamAttempt(restaurantId: number, attemptId: number, payload: ExamSubmitPayload): Promise<ExamSubmitResultDto> {
  const { data } = await apiClient.post(`/api/restaurants/${restaurantId}/training/exam-attempts/${attemptId}/submit`, payload);
  return data as ExamSubmitResultDto;
}
