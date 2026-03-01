import type { ParsedTrainingApiError } from "./trainingApiError";

export type QuestionDeleteDialogMode = "ACTIVE_BLOCK" | "USED_IN_EXAMS" | "GENERIC";

export type QuestionDeleteExamRef = {
  id: number;
  title: string;
  mode: "CERTIFICATION" | "PRACTICE";
  knowledgeFolderId: number | null;
};

export type QuestionDeleteDialogModel = {
  mode: QuestionDeleteDialogMode;
  message: string;
  exams: QuestionDeleteExamRef[];
};

const ACTIVE_HINT = "Сначала скройте вопрос";

export function buildQuestionDeleteDialogModel(parsedError: ParsedTrainingApiError): QuestionDeleteDialogModel {
  const message = parsedError.message || "Не удалось удалить вопрос.";
  const examsRaw = parsedError.payload?.meta?.exams;

  const exams = Array.isArray(examsRaw)
    ? examsRaw
        .map((exam) => {
          if (typeof exam !== "object" || exam === null) return null;
          const examRecord = exam as Record<string, unknown>;
          const id = examRecord.id;
          const title = examRecord.title;
          const mode = examRecord.mode;
          const knowledgeFolderId = examRecord.knowledgeFolderId;

          if (typeof id !== "number" || typeof title !== "string") return null;
          if (mode !== "CERTIFICATION" && mode !== "PRACTICE") return null;
          if (knowledgeFolderId !== null && typeof knowledgeFolderId !== "number") return null;
          if (!title.trim()) return null;

          return { id, title, mode, knowledgeFolderId };
        })
        .filter((exam): exam is QuestionDeleteExamRef => Boolean(exam))
    : [];

  if (message.includes(ACTIVE_HINT)) {
    return {
      mode: "ACTIVE_BLOCK",
      message,
      exams: [],
    };
  }

  if (exams.length > 0) {
    return {
      mode: "USED_IN_EXAMS",
      message,
      exams,
    };
  }

  return {
    mode: "GENERIC",
    message,
    exams: [],
  };
}
