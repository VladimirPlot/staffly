import { BookOpen, ClipboardCheck, Folder, HelpCircle } from "lucide-react";
import type { ReactElement } from "react";

import TrashModal, { type TrashModalItem } from "../../../shared/ui/TrashModal";
import type { TrainingExamDto, TrainingFolderDto, TrainingKnowledgeItemDto, TrainingQuestionDto } from "../api/types";
import { bySortOrderAndName } from "../utils/sort";

export type ArchivedTrainingObject =
  | { kind: "folder"; id: number; title: string; description?: string | null; value: TrainingFolderDto }
  | { kind: "knowledgeItem"; id: number; title: string; description?: string | null; value: TrainingKnowledgeItemDto }
  | { kind: "question"; id: number; title: string; description?: string | null; value: TrainingQuestionDto }
  | { kind: "practiceExam"; id: number; title: string; description?: string | null; value: TrainingExamDto }
  | { kind: "certificationExam"; id: number; title: string; description?: string | null; value: TrainingExamDto };

function iconForKind(kind: ArchivedTrainingObject["kind"]) {
  switch (kind) {
    case "folder":
      return Folder;
    case "knowledgeItem":
      return BookOpen;
    case "question":
      return HelpCircle;
    case "practiceExam":
    case "certificationExam":
      return ClipboardCheck;
  }
}

type NonCertificationArchivedObject = Exclude<ArchivedTrainingObject, { kind: "certificationExam" }>;

type TrainingArchiveModalCommonProps<TObject extends ArchivedTrainingObject> = {
  open: boolean;
  title?: string;
  loadingText?: string;
  emptyText?: string;
  folders: TrainingFolderDto[];
  knowledgeItems?: TrainingKnowledgeItemDto[];
  questions?: TrainingQuestionDto[];
  practiceExams?: TrainingExamDto[];
  loading: boolean;
  error: string | null;
  actionLoading: string | null;
  onClose: () => void;
  onRestore: (object: TObject) => void;
  onDelete: (object: TObject) => void;
  onDeleteAll: () => void;
  showDeleteAll?: boolean;
};

type TrainingArchiveModalProps =
  | (TrainingArchiveModalCommonProps<ArchivedTrainingObject> & { certificationExams: TrainingExamDto[] })
  | (TrainingArchiveModalCommonProps<NonCertificationArchivedObject> & { certificationExams?: never });

function TrainingArchiveModal(
  props: TrainingArchiveModalCommonProps<ArchivedTrainingObject> & { certificationExams: TrainingExamDto[] },
): ReactElement;
function TrainingArchiveModal(
  props: TrainingArchiveModalCommonProps<NonCertificationArchivedObject> & { certificationExams?: never },
): ReactElement;
function TrainingArchiveModal({
  open,
  title = "Архив",
  loadingText = "Загружаем архив...",
  emptyText = "Архив пуст.",
  folders,
  knowledgeItems = [],
  questions = [],
  practiceExams = [],
  certificationExams = [],
  loading,
  error,
  actionLoading,
  onClose,
  onRestore,
  onDelete,
  onDeleteAll,
  showDeleteAll = true,
}: TrainingArchiveModalProps) {
  const archivedObjects = [
    ...folders
      .filter((folder) => !folder.active)
      .sort(bySortOrderAndName)
      .map((folder) => ({
        kind: "folder" as const,
        id: folder.id,
        title: folder.name,
        description: folder.description,
        value: folder,
      })),
    ...knowledgeItems
      .filter((item) => !item.active)
      .sort(bySortOrderAndName)
      .map((item) => ({
        kind: "knowledgeItem" as const,
        id: item.id,
        title: item.title,
        description: item.description,
        value: item,
      })),
    ...questions
      .filter((question) => !question.active)
      .sort(bySortOrderAndName)
      .map((question) => ({
        kind: "question" as const,
        id: question.id,
        title: question.title,
        description: question.prompt,
        value: question,
      })),
    ...practiceExams
      .filter((exam) => !exam.active)
      .sort(bySortOrderAndName)
      .map((exam) => ({
        kind: "practiceExam" as const,
        id: exam.id,
        title: exam.title,
        description: exam.description,
        value: exam,
      })),
    ...certificationExams
      .filter((exam) => !exam.active)
      .sort(bySortOrderAndName)
      .map((exam) => ({
        kind: "certificationExam" as const,
        id: exam.id,
        title: exam.title,
        description: exam.description,
        value: exam,
      })),
  ];

  const items: Array<TrashModalItem<ArchivedTrainingObject["kind"], ArchivedTrainingObject>> = archivedObjects.map(
    (object) => ({
      key: `${object.kind}-${object.id}`,
      kind: object.kind,
      value: object,
      typeLabel: typeLabelForKind(object.kind),
      typePluralLabel: typePluralLabelForKind(object.kind),
      title: object.title,
      description: object.description,
      icon: iconForKind(object.kind),
      restoreActionKey: `restore-${object.kind}-${object.id}`,
      deleteActionKey: `delete-${object.kind}-${object.id}`,
    }),
  );

  return (
    <TrashModal
      open={open}
      title={title}
      items={items}
      loading={loading}
      loadingText={loadingText}
      emptyText={emptyText}
      error={error}
      actionLoading={actionLoading}
      searchPlaceholder="Поиск по архиву"
      onClose={onClose}
      onRestore={(item) => (onRestore as (object: ArchivedTrainingObject) => void)(item.value)}
      onDelete={(item) => (onDelete as (object: ArchivedTrainingObject) => void)(item.value)}
      onDeleteAll={onDeleteAll}
      showDeleteAll={showDeleteAll}
    />
  );
}

export default TrainingArchiveModal;

function typeLabelForKind(kind: ArchivedTrainingObject["kind"]) {
  switch (kind) {
    case "folder":
      return "Папка";
    case "knowledgeItem":
      return "Карточка";
    case "question":
      return "Вопрос";
    case "practiceExam":
      return "Тест";
    case "certificationExam":
      return "Аттестация";
  }
}

function typePluralLabelForKind(kind: ArchivedTrainingObject["kind"]) {
  switch (kind) {
    case "folder":
      return "Папки";
    case "knowledgeItem":
      return "Карточки";
    case "question":
      return "Вопросы";
    case "practiceExam":
      return "Тесты";
    case "certificationExam":
      return "Аттестации";
  }
}
