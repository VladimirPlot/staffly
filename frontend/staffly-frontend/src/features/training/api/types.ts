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

export type TrainingKnowledgeItemDto = {
  id: number;
  restaurantId: number;
  folderId: number;
  title: string;
  content: string;
  sortOrder: number;
  active: boolean;
};

export type TrainingQuestionDto = {
  id: number;
  restaurantId: number;
  folderId: number;
  text: string;
  explanation?: string | null;
  active: boolean;
  sortOrder?: number;
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

export type ExamProgressDto = {
  examId: number;
  passed: boolean;
  lastAttemptAt?: string | null;
  scorePercent?: number | null;
  attemptsCount?: number;
};

export type ExamStartQuestionOptionDto = {
  id: number;
  text: string;
};

export type ExamStartQuestionDto = {
  id: number;
  text: string;
  options: ExamStartQuestionOptionDto[];
};

export type ExamAttemptDto = {
  attemptId: number;
  examId: number;
  status: "IN_PROGRESS" | "SUBMITTED" | string;
  startedAt?: string;
  timeLimitSec?: number | null;
  questions: ExamStartQuestionDto[];
};

export type ExamSubmitAnswerDto = {
  questionId: number;
  optionId: number;
};

export type ExamSubmitPayload = {
  answers: ExamSubmitAnswerDto[];
};

export type ExamSubmitResultDto = {
  attemptId: number;
  examId: number;
  passed: boolean;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  submittedAt: string;
};
