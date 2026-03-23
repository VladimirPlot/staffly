import type { PersistedExamRunState } from "./types";

export function getStorageKey(examId: number) {
  return `training_exam_run_${examId}`;
}

export function parseJson<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readPersistedExamRunState(examId: number) {
  return parseJson<PersistedExamRunState>(localStorage.getItem(getStorageKey(examId)) ?? undefined);
}

export function writePersistedExamRunState(examId: number, state: PersistedExamRunState) {
  localStorage.setItem(getStorageKey(examId), JSON.stringify(state));
}

export function removePersistedExamRunState(examId: number) {
  localStorage.removeItem(getStorageKey(examId));
}
