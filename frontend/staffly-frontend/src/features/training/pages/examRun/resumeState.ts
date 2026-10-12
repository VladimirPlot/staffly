import type { ExamAttemptDto } from "../../api/types";
import type { PersistedExamRunState } from "./types";

export function restoreExamRun(response: ExamAttemptDto, persisted: PersistedExamRunState | null) {
  const savedAnswers = Object.fromEntries((response.savedAnswers ?? [])
    .filter((answer) => answer.answerJson != null)
    .map((answer) => [answer.questionId, answer.answerJson as string]));
  const confirmedQuestionIds = Object.keys(savedAnswers).map(Number);
  const sameAttempt = persisted?.attemptId === response.attemptId;
  const firstUnconfirmed = response.questions.findIndex((question) => !confirmedQuestionIds.includes(question.questionId));
  const lastIndex = Math.max(response.questions.length - 1, 0);
  const nextIndex = firstUnconfirmed < 0 ? lastIndex : firstUnconfirmed;
  return {
    answers: { ...(sameAttempt ? persisted.answers : {}), ...savedAnswers },
    confirmedQuestionIds,
    currentIndex: sameAttempt
      ? Math.min(Math.max(persisted.currentIndex ?? 0, 0), nextIndex)
      : nextIndex,
  };
}
