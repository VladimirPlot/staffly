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
  visibilityPositionIds: number[];
};

export type CreateTrainingFolderPayload = {
  name: string;
  description?: string | null;
  parentId?: number | null;
  type: TrainingFolderType;
  visibilityPositionIds?: number[];
};

export type UpdateTrainingFolderPayload = {
  name: string;
  description?: string | null;
  visibilityPositionIds?: number[] | null;
};

export type TrainingKnowledgeItemDto = {
  id: number;
  restaurantId: number;
  folderId: number | null;
  title: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  active: boolean;
};

export type CreateKnowledgeItemPayload = {
  folderId?: number | null;
  title: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

export type UpdateKnowledgeItemPayload = {
  folderId?: number | null;
  title: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  sortOrder?: number;
};

export type TrainingQuestionType = "SINGLE" | "MULTI" | "TRUE_FALSE" | "FILL_SELECT" | "MATCH";
export type TrainingExamMode = "CERTIFICATION" | "PRACTICE";

export type TrainingQuestionOptionDto = {
  id?: number;
  text: string;
  correct: boolean;
  sortOrder: number;
};

export type TrainingQuestionMatchPairDto = {
  id?: number;
  leftText: string;
  rightText: string;
  sortOrder: number;
};

export type TrainingQuestionDto = {
  id: number;
  restaurantId: number;
  folderId: number;
  type: TrainingQuestionType;
  prompt: string;
  explanation?: string | null;
  sortOrder: number;
  active: boolean;
  options: TrainingQuestionOptionDto[];
  matchPairs: TrainingQuestionMatchPairDto[];
};

export type CreateQuestionPayload = {
  folderId: number;
  type: TrainingQuestionType;
  prompt: string;
  explanation?: string | null;
  sortOrder?: number;
  options?: TrainingQuestionOptionDto[];
  matchPairs?: TrainingQuestionMatchPairDto[];
};

export type UpdateQuestionPayload = Omit<CreateQuestionPayload, "folderId"> & {
  folderId?: number;
  active?: boolean;
};

export type TrainingExamDto = {
  id: number;
  restaurantId: number;
  title: string;
  description?: string | null;
  questionCount: number;
  passPercent: number;
  timeLimitSec?: number | null;
  mode: TrainingExamMode;
  attemptLimit?: number | null;
  version: number;
  active: boolean;
  folderIds: number[];
  visibilityPositionIds: number[];
};

export type UpsertExamPayload = {
  title: string;
  description?: string | null;
  mode: TrainingExamMode;
  questionCount: number;
  passPercent: number;
  timeLimitSec?: number | null;
  attemptLimit?: number | null;
  folderIds: number[];
  visibilityPositionIds: number[];
  active?: boolean;
};

export type ExamProgressDto = {
  examId: number;
  passed: boolean;
  lastAttemptAt?: string | null;
  scorePercent?: number | null;
};

export type ExamResultRowDto = {
  userId: number;
  fullName: string;
  attemptsUsed: number;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  passed: boolean;
};

export type ExamStartQuestionOptionViewDto = { sortOrder: number; text: string };
export type ExamStartQuestionMatchPairViewDto = { sortOrder: number; leftText: string; rightText: string };

export type AttemptQuestionSnapshotDto = {
  questionId: number;
  type: TrainingQuestionType;
  prompt: string;
  explanation?: string | null;
  options: ExamStartQuestionOptionViewDto[];
  matchPairs: ExamStartQuestionMatchPairViewDto[];
};

export type ExamAttemptDto = {
  attemptId: number;
  startedAt: string;
  examVersion: number;
  exam: TrainingExamDto;
  questions: AttemptQuestionSnapshotDto[];
};

export type ExamSubmitAnswerDto = { questionId: number; answerJson: string };
export type ExamSubmitPayload = { answers: ExamSubmitAnswerDto[] };

export type AttemptResultQuestionDto = { questionId: number; chosenAnswerJson: string | null; correct: boolean };

export type ExamSubmitResultDto = {
  attemptId: number;
  examId: number | null;
  examVersion: number;
  userId: number;
  startedAt: string;
  finishedAt: string;
  scorePercent: number;
  passed: boolean;
  answers: AttemptResultQuestionDto[];
};
