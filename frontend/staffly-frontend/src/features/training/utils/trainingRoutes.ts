export const trainingRoutes = {
  landing: "/training",
  knowledge: "/training/knowledge",
  knowledgeFolder: (folderId: number) => `/training/knowledge/${folderId}`,
  questionBank: "/training/question-bank",
  questionBankFolder: (folderId: number) => `/training/question-bank/${folderId}`,
  exams: "/training/exams",
  examRun: (examId: number) => `/training/exams/${examId}/run`,
  knowledgeExamRun: (folderId: number, examId: number) => `/training/knowledge/${folderId}/exams/${examId}/run`,
} as const;
