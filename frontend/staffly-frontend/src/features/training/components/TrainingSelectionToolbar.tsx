import { BookOpen, ClipboardCheck, Edit3, ExternalLink, Folder, HelpCircle, MoveRight, Trash2, X } from "lucide-react";

import { cn } from "../../../shared/lib/cn";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { TrainingFolderDto, TrainingKnowledgeItemDto, TrainingQuestionDto, TrainingExamDto } from "../api/types";
import type { TrainingFolderListObject } from "../trainingFolderObjects";
import { trainingObjectTitle } from "../trainingFolderObjects";

const toolbarButtonClassName =
  "h-11 w-11 rounded-full border border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/74 px-0 text-xs shadow-none backdrop-blur transition-colors hover:bg-[color:var(--staffly-control-hover)] active:scale-[0.98] [&>span:first-child]:flex [&>span:first-child]:h-full [&>span:first-child]:w-full [&>span:first-child]:items-center [&>span:first-child]:justify-center [&>span:first-child>svg]:block [&>span:last-child]:hidden sm:h-8 sm:w-auto sm:px-2.5 sm:[&>span:first-child]:h-auto sm:[&>span:first-child]:w-auto sm:[&>span:last-child]:inline";

type Props = {
  object: TrainingFolderListObject | null;
  visible: boolean;
  actionLoading: string | null;
  canManage: boolean;
  onOpen: (object: TrainingFolderListObject) => void;
  onEditFolder: (folder: TrainingFolderDto) => void;
  onEditKnowledgeItem: (item: TrainingKnowledgeItemDto) => void;
  onEditQuestion: (question: TrainingQuestionDto) => void;
  onEditPracticeExam: (exam: TrainingExamDto) => void;
  onMove: (object: TrainingFolderListObject) => void;
  onArchive: (object: TrainingFolderListObject) => void;
  onClear: () => void;
};

function objectIcon(object: TrainingFolderListObject) {
  switch (object.kind) {
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

function objectLabel(object: TrainingFolderListObject) {
  switch (object.kind) {
    case "folder":
      return "Папка";
    case "knowledgeItem":
      return "Карточка";
    case "question":
      return "Вопрос";
    case "practiceExam":
      return "Учебный тест";
  }
}

export default function TrainingSelectionToolbar({
  object,
  visible,
  actionLoading,
  canManage,
  onOpen,
  onEditFolder,
  onEditKnowledgeItem,
  onEditQuestion,
  onEditPracticeExam,
  onMove,
  onArchive,
  onClear,
}: Props) {
  if (!object) return null;

  const title = trainingObjectTitle(object);
  const IconComponent = objectIcon(object);
  const archiveActionKey = `archive-${object.kind}-${object.id}`;
  const isArchiving = actionLoading === archiveActionKey;

  const edit = () => {
    if (object.kind === "folder") onEditFolder(object.folder);
    else if (object.kind === "knowledgeItem") onEditKnowledgeItem(object.item);
    else if (object.kind === "question") onEditQuestion(object.question);
    else onEditPracticeExam(object.exam);
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-3 bottom-5 z-[60] flex justify-center pb-[env(safe-area-inset-bottom)] transition-opacity duration-150 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      aria-hidden={!visible}
    >
      <section
        data-training-selection-toolbar="true"
        className="pointer-events-auto w-[min(calc(100vw-1.5rem),36rem)] max-w-full overflow-hidden rounded-full border border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/92 px-2 py-2 shadow-[0_12px_34px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.75)_inset] backdrop-blur-xl sm:w-auto sm:px-2.5"
        aria-label="Действия с выбранным объектом"
      >
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1 sm:flex-none sm:gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--staffly-control)] text-[color:var(--staffly-text-strong)]">
              <Icon icon={IconComponent} size="sm" decorative />
            </span>
            <span className="min-w-0 sm:max-w-[13rem]">
              <span className="text-muted block truncate text-[11px] font-medium">{objectLabel(object)} · выбран</span>
              <span className="text-strong block truncate text-sm font-semibold" title={title}>
                {title}
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {object.kind !== "knowledgeItem" ? (
              <Button
                size="sm"
                variant="ghost"
                className={toolbarButtonClassName}
                title="Открыть"
                leftIcon={<Icon icon={ExternalLink} size="sm" decorative />}
                onClick={() => onOpen(object)}
              >
                Открыть
              </Button>
            ) : null}
            {canManage ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className={toolbarButtonClassName}
                  title="Изменить"
                  leftIcon={<Icon icon={Edit3} size="sm" decorative />}
                  onClick={edit}
                >
                  Изменить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={toolbarButtonClassName}
                  title="Переместить"
                  leftIcon={<Icon icon={MoveRight} size="sm" decorative />}
                  onClick={() => onMove(object)}
                >
                  Переместить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(toolbarButtonClassName, "text-red-600")}
                  title="В корзину"
                  isLoading={isArchiving}
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  onClick={() => onArchive(object)}
                >
                  В корзину
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className={toolbarButtonClassName}
              title="Снять выбор"
              leftIcon={<Icon icon={X} size="sm" decorative />}
              onClick={onClear}
            >
              Снять выбор
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
