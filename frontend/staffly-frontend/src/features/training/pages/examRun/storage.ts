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
  try {
    return parseJson<PersistedExamRunState>(localStorage.getItem(getStorageKey(examId)) ?? undefined);
  } catch {
    return null;
  }
}

export function writePersistedExamRunState(examId: number, state: PersistedExamRunState) {
  try {
    localStorage.setItem(getStorageKey(examId), JSON.stringify(state));
  } catch {
    // Server confirmations remain available even when browser draft storage is blocked/full.
  }
}

export function removePersistedExamRunState(examId: number) {
  try {
    localStorage.removeItem(getStorageKey(examId));
  } catch {
    // A stale draft is ignored by its attempt id when the next attempt starts.
  }
}
