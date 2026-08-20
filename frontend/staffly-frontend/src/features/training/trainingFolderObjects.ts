import type {
  TrainingExamDto,
  TrainingFolderDto,
  TrainingKnowledgeItemDto,
  TrainingQuestionDto,
} from "./api/types";

export type TrainingFolderObject = {
  kind: "folder";
  id: number;
  sortOrder: number;
  folder: TrainingFolderDto;
};

export type TrainingKnowledgeItemObject = {
  kind: "knowledgeItem";
  id: number;
  sortOrder: number;
  item: TrainingKnowledgeItemDto;
};

export type TrainingQuestionObject = {
  kind: "question";
  id: number;
  sortOrder: number;
  question: TrainingQuestionDto;
};

export type TrainingPracticeExamObject = {
  kind: "practiceExam";
  id: number;
  sortOrder: number;
  exam: TrainingExamDto;
};

export type TrainingFolderListObject =
  | TrainingFolderObject
  | TrainingKnowledgeItemObject
  | TrainingQuestionObject
  | TrainingPracticeExamObject;

export type TrainingMoveTarget = {
  kind: TrainingFolderListObject["kind"] | "certificationExam";
  id: number;
  title: string;
};

export type TrainingPermanentDeleteTarget =
  | { kind: "folder"; id: number; title: string }
  | { kind: "knowledgeItem"; id: number; title: string }
  | { kind: "question"; id: number; title: string }
  | { kind: "practiceExam"; id: number; title: string }
  | { kind: "all"; title: string };

export function trainingObjectTitle(object: TrainingFolderListObject): string {
  switch (object.kind) {
    case "folder":
      return object.folder.name;
    case "knowledgeItem":
      return object.item.title;
    case "question":
      return object.question.title;
    case "practiceExam":
      return object.exam.title;
  }
}

export function trainingObjectActive(object: TrainingFolderListObject): boolean {
  switch (object.kind) {
    case "folder":
      return object.folder.active;
    case "knowledgeItem":
      return object.item.active;
    case "question":
      return object.question.active;
    case "practiceExam":
      return object.exam.active;
  }
}
