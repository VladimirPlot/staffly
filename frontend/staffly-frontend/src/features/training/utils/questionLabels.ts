import type { TrainingQuestionType } from "../api/types";

export const QUESTION_TYPE_ORDER: TrainingQuestionType[] = ["SINGLE", "FILL_SELECT", "TRUE_FALSE", "MULTI", "MATCH"];

export const QUESTION_TYPE_LABELS: Record<TrainingQuestionType, string> = {
  SINGLE: "Один вариант",
  MULTI: "Несколько вариантов",
  TRUE_FALSE: "Правда / Ложь",
  FILL_SELECT: "Заполнить пропуски",
  MATCH: "Сопоставление",
};
