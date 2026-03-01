import { AlertTriangle, Copy, Link as LinkIcon } from "lucide-react";
import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import type { QuestionDeleteDialogMode, QuestionDeleteExamRef } from "../utils/questionDeleteUx";

type QuestionDeleteGuardModalProps = {
  open: boolean;
  mode: QuestionDeleteDialogMode;
  message: string;
  exams: QuestionDeleteExamRef[];
  loadingAction: "hideAndDelete" | "hideOnly" | null;
  onClose: () => void;
  onHideAndDelete: () => void;
  onHideOnly: () => void;
  onOpenExams: () => void;
  onOpenExam: (examId: number) => void;
  onCopyExamList: () => void;
};

export default function QuestionDeleteGuardModal({
  open,
  mode,
  message,
  exams,
  loadingAction,
  onClose,
  onHideAndDelete,
  onHideOnly,
  onOpenExams,
  onOpenExam,
  onCopyExamList,
}: QuestionDeleteGuardModalProps) {
  const isBusy = loadingAction !== null;

  const titleByMode: Record<QuestionDeleteDialogMode, string> = {
    ACTIVE_BLOCK: "Нельзя удалить активный вопрос",
    USED_IN_EXAMS: "Вопрос используется в тестах",
    GENERIC: "Не удалось удалить",
  };

  const descriptionByMode: Record<QuestionDeleteDialogMode, string> = {
    ACTIVE_BLOCK: "Сначала скройте вопрос, затем повторите удаление.",
    USED_IN_EXAMS: "Уберите вопрос/папку из источников этих тестов и повторите удаление.",
    GENERIC: message,
  };

  return (
    <Modal
      open={open}
      title={titleByMode[mode]}
      description={descriptionByMode[mode]}
      onClose={isBusy ? () => {} : onClose}
      footer={
        <>
          {mode === "ACTIVE_BLOCK" && (
            <>
              <Button variant="outline" onClick={onClose} disabled={isBusy}>
                Отмена
              </Button>
              <Button variant="outline" onClick={onHideOnly} isLoading={loadingAction === "hideOnly"}>
                Только скрыть
              </Button>
              <Button onClick={onHideAndDelete} isLoading={loadingAction === "hideAndDelete"}>
                Скрыть и удалить
              </Button>
            </>
          )}
          {mode === "USED_IN_EXAMS" && (
            <>
              <Button variant="outline" onClick={onClose} disabled={isBusy}>
                Закрыть
              </Button>
              <Button variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={onCopyExamList}>
                Скопировать список
              </Button>
              <Button leftIcon={<LinkIcon className="h-4 w-4" />} onClick={onOpenExams}>
                Открыть список тестов
              </Button>
            </>
          )}
          {mode === "GENERIC" && (
            <Button onClick={onClose}>
              Понятно
            </Button>
          )}
        </>
      }
    >
      {mode === "USED_IN_EXAMS" && (
        <div className="space-y-3 text-sm text-default">
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="whitespace-pre-line">
              Вопрос связан с активными источниками тестов. Сначала удалите его из источников и только потом повторите удаление.
            </p>
          </div>

          <div>
            <div className="mb-2 font-medium text-strong">Связанные тесты:</div>
            <ul className="space-y-1">
              {exams.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between gap-2 rounded-xl border border-subtle px-3 py-2">
                  <span className="whitespace-pre-line">• {exam.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<LinkIcon className="h-4 w-4" />}
                    onClick={() => onOpenExam(exam.id)}
                  >
                    Открыть
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {mode === "GENERIC" && <p className="text-sm whitespace-pre-line text-default">{message}</p>}
    </Modal>
  );
}
