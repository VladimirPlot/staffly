import type { TrainingQuestionBlankDto, TrainingQuestionGroup, TrainingQuestionType } from "../../../api/types";

export type QuestionEditorStep = "usage" | "type" | "editor";

export type QuestionOptionDraft = {
  text: string;
  correct: boolean;
};

export type QuestionPairDraft = {
  leftText: string;
  rightText: string;
};

export type QuestionEditorProps = {
  questionGroup: TrainingQuestionGroup;
  type: TrainingQuestionType;
  title: string;
  prompt: string;
  explanation: string;
  options: QuestionOptionDraft[];
  pairs: QuestionPairDraft[];
  blanks: TrainingQuestionBlankDto[];
  duplicates: Set<string>;
};
