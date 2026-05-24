import { trainingRoutes } from "./trainingRoutes";

const TRAINING_EXAMS_PREFIX = trainingRoutes.exams;
const TRAINING_EXAMS_ALLOWED_PATTERN = /^\/training\/exams(?:$|[/?].*)/;

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

  if (!TRAINING_EXAMS_ALLOWED_PATTERN.test(decoded)) {
    return TRAINING_EXAMS_PREFIX;
  }

  return trimTrailingQuestion(decoded);
}

export function withReturnToParam(pathname: string, returnTo: string): string {
  const normalizedReturnTo = normalizeTrainingExamsReturnTo(returnTo);
  const [pathOnly, query = ""] = pathname.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("returnTo", normalizedReturnTo);
  const nextQuery = params.toString();
  return nextQuery ? `${pathOnly}?${nextQuery}` : pathOnly;
}

export function buildTrainingExamsReturnTo(pathname: string, search = ""): string {
  const candidate = `${pathname}${search}`;
  return normalizeTrainingExamsReturnTo(candidate);
}
