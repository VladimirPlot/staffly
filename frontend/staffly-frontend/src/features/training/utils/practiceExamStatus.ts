import type { ExamProgressDto } from "../api/types";

export type PracticeExamStatus = "PASSED" | "FAILED" | "IN_PROGRESS" | null;

export function getExamRunStorageKey(examId: number) {
  return `training_exam_run_${examId}`;
}

export function hasInProgressExamAttempt(examId: number) {
  try {
    return Boolean(localStorage.getItem(getExamRunStorageKey(examId)));
  } catch {
    return false;
  }
}

export function getPracticeExamStatus(
  examId: number,
  progress: ExamProgressDto | undefined,
  inProgressIds: Set<number>,
): PracticeExamStatus {
  if (inProgressIds.has(examId)) return "IN_PROGRESS";
  if (!progress) return null;
  return progress.passed ? "PASSED" : "FAILED";
}
