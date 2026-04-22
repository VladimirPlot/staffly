import { trainingRoutes } from "./trainingRoutes";

const TRAINING_EXAMS_PREFIX = trainingRoutes.exams;

function trimTrailingQuestion(path: string): string {
  return path.endsWith("?") ? path.slice(0, -1) : path;
}

export function normalizeTrainingExamsReturnTo(rawReturnTo: string | null | undefined): string {
  if (!rawReturnTo) {
    return TRAINING_EXAMS_PREFIX;
  }

  const normalizedRaw = rawReturnTo.trim();
  if (!normalizedRaw) {
    return TRAINING_EXAMS_PREFIX;
  }

  let decoded = normalizedRaw;
  try {
    decoded = decodeURIComponent(normalizedRaw);
  } catch {
    decoded = normalizedRaw;
  }

  if (!decoded || decoded.includes("://") || decoded.startsWith("//")) {
    return TRAINING_EXAMS_PREFIX;
  }

  if (!decoded.startsWith(TRAINING_EXAMS_PREFIX)) {
    return TRAINING_EXAMS_PREFIX;
  }

  return trimTrailingQuestion(decoded);
}

export function withReturnToParam(pathname: string, returnTo: string): string {
  const normalizedReturnTo = normalizeTrainingExamsReturnTo(returnTo);
  return `${pathname}?returnTo=${encodeURIComponent(normalizedReturnTo)}`;
}
