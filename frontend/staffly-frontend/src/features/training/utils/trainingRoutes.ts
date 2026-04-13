export const trainingRoutes = {
  landing: "/training",
  knowledge: "/training/knowledge",
  knowledgeFolder: (folderId: number) => `/training/knowledge/${folderId}`,
  questionBank: "/training/question-bank",
  questionBankFolder: (folderId: number) => `/training/question-bank/${folderId}`,
  exams: "/training/exams",
  examRun: (examId: number) => `/training/exams/${examId}/run`,
  examResult: (examId: number) => `/training/exams/${examId}/result`,
  examAnalytics: (examId: number) => `/training/exams/${examId}/analytics`,
  knowledgeExamRun: (folderId: number, examId: number) => `/training/knowledge/${folderId}/exams/${examId}/run`,
} as const;
