import { isAxiosError } from "axios";

export type TrainingApiErrorPayload = {
  error?: string;
  message?: string;
  meta?: Record<string, unknown> | null;
};

export type ParsedTrainingApiError = {
  status: number | null;
  message: string | null;
  payload: TrainingApiErrorPayload | null;
  raw: unknown;
};

export function parseTrainingApiError(error: unknown): ParsedTrainingApiError {
  if (!isAxiosError(error)) {
    return {
      status: null,
      message: null,
      payload: null,
      raw: error,
    };
  }

  const status = error.response?.status ?? null;
  const responseData = error.response?.data;

  if (typeof responseData === "object" && responseData !== null) {
    const payload = responseData as TrainingApiErrorPayload;
    return {
      status,
      message: typeof payload.message === "string" ? payload.message : null,
      payload,
      raw: error,
    };
  }

  if (typeof responseData === "string") {
    return {
      status,
      message: responseData,
      payload: {
        message: responseData,
      },
      raw: error,
    };
  }

  return {
    status,
    message: typeof error.message === "string" ? error.message : null,
    payload: null,
    raw: error,
  };
}
