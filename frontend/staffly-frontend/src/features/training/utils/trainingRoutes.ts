export const trainingRoutes = {
  landing: "/training",
  knowledge: "/training/knowledge",
  questionBank: "/training/question-bank",
  questionBankFolder: (folderId: number) => `/training/question-bank/${folderId}`,
  exams: "/training/exams",
  examRun: (examId: number) => `/training/exams/${examId}/run`,
} as const;
