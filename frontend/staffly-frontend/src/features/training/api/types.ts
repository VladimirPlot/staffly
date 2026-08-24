export type TrainingFolderType = "KNOWLEDGE" | "QUESTION_BANK" | "CERTIFICATION";

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
  manageable: boolean;
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

export type TrainingQuestionGroup = "PRACTICE" | "CERTIFICATION";

export type TrainingQuestionBlankOptionDto = {
  id?: number;
  text: string;
  correct: boolean;
  sortOrder: number;
};

export type TrainingQuestionBlankDto = {
  id?: number;
  index: number;
  options: TrainingQuestionBlankOptionDto[];
};

export type TrainingQuestionDto = {
  id: number;
  restaurantId: number;
  folderId: number;
  type: TrainingQuestionType;
  questionGroup: TrainingQuestionGroup;
  title: string;
  prompt: string;
  explanation?: string | null;
  sortOrder: number;
  active: boolean;
  options: TrainingQuestionOptionDto[];
  matchPairs: TrainingQuestionMatchPairDto[];
  blanks: TrainingQuestionBlankDto[];
};

export type CreateQuestionPayload = {
  folderId: number;
  type: TrainingQuestionType;
  questionGroup: TrainingQuestionGroup;
  title: string;
  prompt: string;
  explanation?: string | null;
  sortOrder?: number;
  options?: TrainingQuestionOptionDto[];
  matchPairs?: TrainingQuestionMatchPairDto[];
  blanks?: TrainingQuestionBlankDto[];
};

export type UpdateQuestionPayload = Omit<CreateQuestionPayload, "folderId"> & {
  folderId?: number;
  active?: boolean;
};

export type ExamSourceFolderPickMode = "ALL" | "RANDOM";

export type ExamSourceFolderDto = {
  folderId: number;
  pickMode: ExamSourceFolderPickMode;
  randomCount?: number | null;
};

export type ExamSourcesPreflightDto = {
  availableQuestionCount: number;
  valid: boolean;
  issues: string[];
};

export type ExamSourcesPreflightPayload = {
  mode: TrainingExamMode;
  questionCount?: number | null;
  sourcesFolders: ExamSourceFolderDto[];
  sourceQuestionIds: number[];
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
  knowledgeFolderId: number | null;
  folderId: number | null;
  attemptLimit?: number | null;
  version: number;
  editorRevision: number;
  sortOrder: number;
  active: boolean;
  sourcesFolders: ExamSourceFolderDto[];
  sourceQuestionIds: number[];
  visibilityPositionIds: number[];
  createdByUserId?: number | null;
  createdByFullName?: string | null;
  ownerUserId?: number | null;
  ownerFullName?: string | null;
  certificationSummaryPreview?: CertificationExamSummaryPreviewDto | null;
};

export type CertificationOwnerCandidateDto = {
  userId: number;
  fullName: string;
  role: string;
  positionId?: number | null;
  positionName?: string | null;
};

export type CertificationOwnerCandidatesDto = {
  examId: number;
  title: string;
  currentOwnerUserId?: number | null;
  currentOwnerFullName?: string | null;
  candidates: CertificationOwnerCandidateDto[];
};

export type CertificationExamSummaryPreviewDto = {
  totalAssigned: number;
  passedCount: number;
  failedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completedCount: number;
};

export type CurrentUserCertificationExamDto = {
  examId: number;
  title: string;
  description?: string | null;
  questionCount: number;
  passPercent: number;
  timeLimitSec?: number | null;
  baseAttemptLimit?: number | null;
  active: boolean;
  assignmentId: number;
  assignmentStatus: CertificationAssignmentStatus;
  assignedAt: string;
  examVersionSnapshot?: number | null;
  attemptsUsed: number;
  attemptsAllowed?: number | null;
  extraAttempts: number;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  passedAt?: string | null;
};

export type CertificationMyResultQuestionDto = {
  questionId: number;
  questionType: TrainingQuestionType;
  prompt: string;
  chosenAnswerJson?: string | null;
  correct?: boolean | null;
  correctAnswerJson?: string | null;
  explanation?: string | null;
};

export type CertificationMyResultDto = {
  examId: number;
  title: string;
  description?: string | null;
  assignmentStatus: CertificationAssignmentStatus;
  scorePercent?: number | null;
  passPercent: number;
  attemptsUsed: number;
  attemptsAllowed?: number | null;
  revealCorrectAnswers: boolean;
  bestScore?: number | null;
  lastAttemptStartedAt?: string | null;
  lastAttemptFinishedAt?: string | null;
  lastAttemptAt?: string | null;
  passedAt?: string | null;
  questions: CertificationMyResultQuestionDto[];
};

export type UpsertExamPayload = {
  expectedEditorRevision?: number;
  confirmNewVersion?: boolean;
  title: string;
  description?: string | null;
  mode: TrainingExamMode;
  knowledgeFolderId?: number | null;
  folderId?: number | null;
  questionCount: number;
  passPercent: number;
  timeLimitSec?: number | null;
  attemptLimit?: number | null;
  sourcesFolders: ExamSourceFolderDto[];
  sourceQuestionIds: number[];
  visibilityPositionIds: number[];
  active?: boolean;
};

export type ExamProgressDto = {
  examId: number;
  passed: boolean;
  lastAttemptAt?: string | null;
  scorePercent?: number | null;
};

export type CertificationExamSummaryDto = {
  totalAssigned: number;
  passedCount: number;
  failedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completedCount: number;
  averageScore?: number | null;
  passRate?: number | null;
};

export type CertificationExamPositionBreakdownDto = {
  positionId: number;
  positionName: string;
  assignedCount: number;
  passedCount: number;
  failedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  averageScore?: number | null;
  passRate?: number | null;
};

export type CertificationAnalyticsStatus = "NOT_STARTED" | "IN_PROGRESS" | "PASSED" | "FAILED";

export type CertificationAssignmentStatus = "ASSIGNED" | "IN_PROGRESS" | "PASSED" | "FAILED" | "EXHAUSTED" | "ARCHIVED";

export type CertificationExamEmployeeRowDto = {
  assignmentId: number;
  userId: number;
  fullName: string;
  assignedPositionId?: number | null;
  assignedPositionName?: string | null;
  currentPositionId?: number | null;
  currentPositionName?: string | null;
  status: CertificationAssignmentStatus;
  analyticsStatus: CertificationAnalyticsStatus;
  attemptsUsed: number;
  attemptsAllowed?: number | null;
  extraAttempts: number;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  passedAt?: string | null;
};

export type CertificationExamAttemptHistoryDto = {
  attemptId: number;
  assignmentId?: number | null;
  assignmentExamVersionSnapshot?: number | null;
  startedAt: string;
  finishedAt?: string | null;
  scorePercent?: number | null;
  passed?: boolean | null;
  examVersion?: number | null;
};

export type CertificationEmployeeSummaryDto = {
  userId: number;
  fullName: string;
  positionId?: number | null;
  positionName?: string | null;
  assignedCount: number;
  completedCount: number;
  passedCount: number;
  failedCount: number;
};

export type CertificationEmployeeExamDto = {
  examId: number;
  examTitle: string;
  analyticsStatus: CertificationAnalyticsStatus;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  attemptsUsed: number;
  attemptsAllowed?: number | null;
};

export type CertificationAttemptDetailsQuestionDto = {
  questionId: number;
  questionType: TrainingQuestionType;
  prompt: string;
  chosenAnswerJson?: string | null;
  correct: boolean;
  correctAnswerJson?: string | null;
  explanation?: string | null;
};

export type CertificationAttemptDetailsDto = {
  attemptId: number;
  examId: number;
  examTitle: string;
  userId: number;
  userFullName: string;
  assignmentId?: number | null;
  examVersion?: number | null;
  startedAt: string;
  finishedAt?: string | null;
  scorePercent?: number | null;
  passPercent: number;
  passed: boolean;
  questionCount?: number | null;
  durationSec?: number | null;
  questions: CertificationAttemptDetailsQuestionDto[];
};

export type ExamStartQuestionOptionViewDto = { sortOrder: number; text: string };
export type ExamRuntimeQuestionItemDto = { sortOrder: number; text: string };

export type ExamStartQuestionBlankOptionViewDto = { sortOrder: number; text: string };
export type ExamStartQuestionBlankViewDto = { blankIndex: number; options: ExamStartQuestionBlankOptionViewDto[] };

export type AttemptQuestionSnapshotDto = {
  questionId: number;
  type: TrainingQuestionType;
  prompt: string;
  explanation?: string | null;
  options: ExamStartQuestionOptionViewDto[];
  matchLeftItems: ExamRuntimeQuestionItemDto[];
  matchRightOptions: ExamRuntimeQuestionItemDto[];
  blanks: ExamStartQuestionBlankViewDto[];
};

export type RuntimeExamDto = {
  id: number;
  title: string;
  questionCount: number;
  timeLimitSec?: number | null;
  mode: TrainingExamMode;
};

export type ExamAttemptDto = {
  attemptId: number;
  startedAt: string;
  examVersion: number;
  exam: RuntimeExamDto;
  questions: AttemptQuestionSnapshotDto[];
};

export type ExamSubmitAnswerDto = { questionId: number; answerJson?: string | null };
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

export type QuestionBankTreeNodeDto = {
  id: number;
  parentId: number | null;
  name: string;
  active: boolean;
  sortOrder: number;
  questionCount: number;
  children: QuestionBankTreeNodeDto[];
};

export type MoveTrainingFolderPayload = {
  parentId?: number | null;
  sortOrder?: number | null;
};

export type MoveTrainingKnowledgeItemPayload = {
  folderId?: number | null;
  sortOrder?: number | null;
};

export type MoveTrainingQuestionPayload = {
  folderId: number;
  sortOrder?: number | null;
};

export type MoveTrainingPracticeExamPayload = {
  knowledgeFolderId: number;
  sortOrder?: number | null;
};

export type MoveTrainingCertificationExamPayload = {
  folderId?: number | null;
  sortOrder?: number | null;
};

export type ReorderTrainingObjectKind =
  | "FOLDER"
  | "KNOWLEDGE_ITEM"
  | "QUESTION"
  | "PRACTICE_EXAM"
  | "CERTIFICATION_EXAM";

export type ReorderTrainingObjectsPayload = {
  type: TrainingFolderType;
  folderId?: number | null;
  kind: ReorderTrainingObjectKind;
  questionGroup?: TrainingQuestionGroup;
  orderedIds: number[];
};

export type CertificationContainerCapabilitiesDto = {
  folderReorderAllowed: boolean;
  certificationExamReorderAllowed: boolean;
};
