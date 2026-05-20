import { BookOpen, ClipboardCheck, Folder, HelpCircle, RotateCcw, Trash2 } from "lucide-react";

import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import Modal from "../../../shared/ui/Modal";
import type {
  TrainingExamDto,
  TrainingFolderDto,
  TrainingKnowledgeItemDto,
  TrainingQuestionDto,
} from "../api/types";
import { bySortOrderAndName } from "../utils/sort";

export type ArchivedTrainingObject =
  | { kind: "folder"; id: number; title: string; description?: string | null; value: TrainingFolderDto }
  | { kind: "knowledgeItem"; id: number; title: string; description?: string | null; value: TrainingKnowledgeItemDto }
  | { kind: "question"; id: number; title: string; description?: string | null; value: TrainingQuestionDto }
  | { kind: "practiceExam"; id: number; title: string; description?: string | null; value: TrainingExamDto };

function iconForKind(kind: ArchivedTrainingObject["kind"]) {
  switch (kind) {
    case "folder":
      return Folder;
    case "knowledgeItem":
      return BookOpen;
    case "question":
      return HelpCircle;
    case "practiceExam":
      return ClipboardCheck;
  }
}

export default function TrainingArchiveModal({
  open,
  folders,
  knowledgeItems = [],
  questions = [],
  practiceExams = [],
  loading,
  error,
  actionLoading,
  onClose,
  onRestore,
  onDelete,
  onDeleteAll,
}: {
  open: boolean;
  folders: TrainingFolderDto[];
  knowledgeItems?: TrainingKnowledgeItemDto[];
  questions?: TrainingQuestionDto[];
  practiceExams?: TrainingExamDto[];
  loading: boolean;
  error: string | null;
  actionLoading: string | null;
  onClose: () => void;
  onRestore: (object: ArchivedTrainingObject) => void;
  onDelete: (object: ArchivedTrainingObject) => void;
  onDeleteAll: () => void;
}) {
  const archivedObjects: ArchivedTrainingObject[] = [
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
  ];
  const hasItems = archivedObjects.length > 0;

  return (
    <Modal open={open} title="Архив" onClose={onClose} className="max-w-3xl">
      <div className="space-y-3">
        {hasItems ? (
          <div className="border-subtle flex items-center justify-between gap-3 border-b pb-3">
            <div className="text-muted text-sm">{archivedObjects.length} элементов в архиве</div>
            <Button size="sm" variant="outline" className="text-red-600" leftIcon={<Icon icon={Trash2} size="sm" decorative />} onClick={onDeleteAll}>
              Удалить все
            </Button>
          </div>
        ) : null}
        {loading ? <div className="text-muted text-sm">Загружаем архив...</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {!loading && !hasItems ? <div className="text-muted text-sm">Архив пуст.</div> : null}

        {archivedObjects.map((object) => {
          const IconComponent = iconForKind(object.kind);
          return (
            <div key={`${object.kind}-${object.id}`} className="border-subtle bg-app rounded-2xl border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <Icon icon={IconComponent} size="sm" decorative />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{object.title}</span>
                  </div>
                  {object.description ? <div className="text-muted mt-1 line-clamp-2 text-sm">{object.description}</div> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="outline" className="h-9 w-9" title="Восстановить" aria-label={`Восстановить ${object.title}`} isLoading={actionLoading === `restore-${object.kind}-${object.id}`} leftIcon={<Icon icon={RotateCcw} size="sm" decorative />} onClick={() => onRestore(object)} />
                  <Button size="icon" variant="outline" className="h-9 w-9 text-red-600" title="Удалить навсегда" aria-label={`Удалить ${object.title} навсегда`} leftIcon={<Icon icon={Trash2} size="sm" decorative />} onClick={() => onDelete(object)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
