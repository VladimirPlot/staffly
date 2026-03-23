export type MatchPairAnswer = { left: string; right: string };
export type FillBlankAnswer = { blankIndex: number; value: string };

export type PersistedExamRunState = {
  attemptId: number;
  answers: Record<number, string>;
  currentIndex: number;
  confirmedQuestionIds: number[];
};
