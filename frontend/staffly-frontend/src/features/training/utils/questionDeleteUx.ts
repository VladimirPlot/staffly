import type { ParsedTrainingApiError } from "./trainingApiError";

export type QuestionDeleteDialogMode = "ACTIVE_BLOCK" | "USED_IN_EXAMS" | "GENERIC";

export type QuestionDeleteExamRef = {
  id: number;
  title: string;
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
          if (typeof id !== "number" || typeof title !== "string") return null;
          if (!title.trim()) return null;
          return { id, title };
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
