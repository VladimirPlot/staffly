export const trainingRoutes = {
  landing: "/training",
  knowledge: "/training/knowledge",
  questionBank: "/training/question-bank",
  exams: "/training/exams",
  examRun: (examId: number) => `/training/exams/${examId}/run`,
} as const;
