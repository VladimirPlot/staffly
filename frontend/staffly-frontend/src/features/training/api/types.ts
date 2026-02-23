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

export type CreateTrainingFolderPayload = {
  name: string;
  description?: string | null;
  parentId?: number | null;
  type: TrainingFolderType;
};

export type UpdateTrainingFolderPayload = {
  name: string;
  description?: string | null;
};

/** BACKEND: TrainingKnowledgeItemDto */
export type TrainingKnowledgeItemDto = {
  id: number;
  restaurantId: number;
  folderId: number;
  title: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  active: boolean;
};

export type CreateKnowledgeItemPayload = {
  folderId: number;
  title: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

export type UpdateKnowledgeItemPayload = {
  folderId?: number;
  title: string;
  description?: string | null;
  composition?: string | null;
  allergens?: string | null;
  sortOrder?: number;
};

/** BACKEND: TrainingQuestionDto */
export type TrainingQuestionType = "SINGLE" | "MULTI" | "TRUE_FALSE" | "FILL_SELECT" | "MATCH";

export type TrainingQuestionOptionDto = {
  id: number;
  text: string;
  correct: boolean;
  sortOrder: number;
};

export type TrainingQuestionMatchPairDto = {
  id: number;
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

export type TrainingExamDto = {
  id: number;
  restaurantId: number;
  title: string;
  description?: string | null;
  questionCount: number;
  passPercent: number;
  timeLimitSec?: number | null;
  version: number;
  active: boolean;
  folderIds: number[];
};

export type ExamProgressDto = {
  examId: number;
  passed: boolean;
  lastAttemptAt?: string | null;
  scorePercent?: number | null;
};

/** START EXAM: snapshots */
export type ExamStartQuestionOptionViewDto = {
  sortOrder: number;
  text: string;
};

export type ExamStartQuestionMatchPairViewDto = {
  sortOrder: number;
  leftText: string;
  rightText: string;
};

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

/** SUBMIT: backend expects answerJson per questionId */
export type ExamSubmitAnswerDto = {
  questionId: number;
  answerJson: string; // JSON string payload
};

export type ExamSubmitPayload = {
  answers: ExamSubmitAnswerDto[];
};

export type AttemptResultQuestionDto = {
  questionId: number;
  chosenAnswerJson: string | null;
  correct: boolean;
};

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
