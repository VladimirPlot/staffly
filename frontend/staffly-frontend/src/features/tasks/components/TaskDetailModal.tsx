import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Trash } from "lucide-react";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import { getFocusableElements } from "../../../shared/ui/dialogUtils";
import type { TaskCommentDto, TaskDto } from "../api";
import {
  dueDateClassName,
  formatCompletedAt,
  formatRelativeTaskDate,
  formatTaskDate,
  resolveTaskAssignee,
} from "../utils";

type TaskDetailModalProps = {
  open: boolean;
  task: TaskDto | null;
  comments: TaskCommentDto[];
  commentValue: string;
  commentLoading: boolean;
  commentHasNext: boolean;
  commentLoadingMore: boolean;
  onCommentChange: (value: string) => void;
  onAddComment: () => void;
  onLoadMoreComments: () => void;
  onComplete: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
  onClose: () => void;
  canDelete: boolean;
};

const TaskDetailModal = ({
  open,
  task,
  comments,
  commentValue,
  commentLoading,
  commentHasNext,
  commentLoadingMore,
  onCommentChange,
  onAddComment,
  onLoadMoreComments,
  onComplete,
  onDelete,
  onClose,
  canDelete,
}: TaskDetailModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    lastActiveElementRef.current = document.activeElement as HTMLElement | null;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handler);

    const focusTimer = window.setTimeout(() => {
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 0);

    return () => {
      window.removeEventListener("keydown", handler);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return () => {
      lastActiveElementRef.current?.focus();
    };
  }, [open]);

  if (!open || !task || typeof document === "undefined") return null;

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (current === first || !dialogRef.current?.contains(current)) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onMouseDown={handleBackdropMouseDown}
      />
      <div className="pointer-events-none relative flex min-h-[100vh] items-center justify-center p-4 supports-[height:100dvh]:min-h-[100dvh]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="bg-surface pointer-events-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-[var(--staffly-shadow)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]"
        >
          <div className="border-subtle flex items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0">
              <div
                id={titleId}
                className="text-strong text-lg font-semibold [overflow-wrap:anywhere] break-words"
              >
                {task.title}
              </div>
              <div className="text-muted mt-2 text-sm">{resolveTaskAssignee(task)}</div>
            </div>
            <div className="flex items-center gap-2">
              {task.status !== "COMPLETED" && (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  aria-label="Выполнено"
                  onClick={() => onComplete(task)}
                >
                  <Icon icon={Check} size="sm" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                  aria-label="Удалить"
                  onClick={() => onDelete(task)}
                >
                  <Icon icon={Trash} size="sm" />
                </button>
              )}
              <button
                type="button"
                className="border-subtle text-muted hover:bg-app inline-flex h-10 w-10 items-center justify-center rounded-full border"
                aria-label="Закрыть"
                onClick={onClose}
              >
                <Icon icon={ChevronDown} size="sm" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              <div className="text-muted text-sm">Описание</div>
              <div className="text-default text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                {task.description ? task.description : "Нет описания"}
              </div>
            </div>

            <div className="bg-app grid gap-4 rounded-2xl p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted text-xs">Срок</div>
                <div className={`font-medium ${dueDateClassName(task.dueDate)}`}>
                  {formatTaskDate(task.dueDate)}
                </div>
                {task.dueDate && (
                  <div className="text-muted text-xs">{formatRelativeTaskDate(task.dueDate)}</div>
                )}
              </div>
              <div>
                <div className="text-muted text-xs">Приоритет</div>
                <div className="text-default font-medium">{task.priority}</div>
              </div>
              <div>
                <div className="text-muted text-xs">Статус</div>
                <div className="text-default font-medium">
                  {task.status === "COMPLETED" ? "Выполнено" : "Активна"}
                </div>
              </div>
              <div>
                <div className="text-muted text-xs">История выполнения</div>
                <div className="text-default font-medium">
                  {formatCompletedAt(task.completedAt)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Комментарии</div>
                <div className="text-muted text-xs">{comments.length}</div>
              </div>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="text-muted text-sm">Комментариев пока нет.</div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border-subtle rounded-2xl border p-4">
                      <div className="text-muted text-xs">
                        {comment.author?.fullName ?? "Сотрудник"}
                      </div>
                      <div className="text-default mt-2 text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                        {comment.text}
                      </div>
                      <div className="text-muted mt-2 text-[11px]">
                        {comment.createdAt
                          ? new Intl.DateTimeFormat("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(comment.createdAt))
                          : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {commentHasNext && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={onLoadMoreComments}
                    disabled={commentLoadingMore}
                  >
                    {commentLoadingMore ? "Загружаем…" : "Загрузить ещё"}
                  </Button>
                </div>
              )}

              <div className="border-subtle space-y-3 rounded-2xl border p-4">
                <textarea
                  className="border-subtle bg-surface text-default ring-default min-h-[90px] w-full resize-none rounded-2xl border p-3 text-sm outline-none focus:ring-2"
                  placeholder="Напишите комментарий..."
                  value={commentValue}
                  onChange={(event) => onCommentChange(event.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={onAddComment} disabled={commentLoading || !commentValue.trim()}>
                    {commentLoading ? "Отправляем…" : "Отправить"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TaskDetailModal;
