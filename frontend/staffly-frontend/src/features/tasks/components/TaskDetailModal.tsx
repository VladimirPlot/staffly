import React from "react";
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
  onCommentChange: (value: string) => void;
  onAddComment: () => void;
  onComplete: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
  onClose: () => void;
  canDelete: boolean;
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  open,
  task,
  comments,
  commentValue,
  commentLoading,
  onCommentChange,
  onAddComment,
  onComplete,
  onDelete,
  onClose,
  canDelete,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastActiveElementRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (!open) return;
    return () => {
      lastActiveElementRef.current?.focus();
    };
  }, [open]);

  if (!open || !task || typeof document === "undefined") return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={handleBackdropMouseDown}>
      <div className="flex min-h-[100vh] items-center justify-center p-4 supports-[height:100dvh]:min-h-[100dvh]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-zinc-900 break-words [overflow-wrap:anywhere]">
                {task.title}
              </div>
              <div className="mt-2 text-sm text-zinc-500">{resolveTaskAssignee(task)}</div>
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                aria-label="Закрыть"
                onClick={onClose}
              >
                <Icon icon={ChevronDown} size="sm" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div className="space-y-3">
              <div className="text-sm text-zinc-500">Описание</div>
              <div className="text-sm text-zinc-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {task.description ? task.description : "Нет описания"}
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-zinc-500">Срок</div>
                <div className={`font-medium ${dueDateClassName(task.dueDate)}`}>
                  {formatTaskDate(task.dueDate)}
                </div>
                {task.dueDate && (
                  <div className="text-xs text-zinc-500">{formatRelativeTaskDate(task.dueDate)}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-zinc-500">Приоритет</div>
                <div className="font-medium text-zinc-800">{task.priority}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Статус</div>
                <div className="font-medium text-zinc-800">
                  {task.status === "COMPLETED" ? "Выполнено" : "Активна"}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">История выполнения</div>
                <div className="font-medium text-zinc-800">{formatCompletedAt(task.completedAt)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Комментарии</div>
                <div className="text-xs text-zinc-500">{comments.length}</div>
              </div>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="text-sm text-zinc-500">Комментариев пока нет.</div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="rounded-2xl border border-zinc-100 p-4">
                      <div className="text-xs text-zinc-500">
                        {comment.author?.fullName ?? "Сотрудник"}
                      </div>
                      <div className="mt-2 text-sm text-zinc-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {comment.text}
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-400">
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

              <div className="rounded-2xl border border-zinc-100 p-4 space-y-3">
                <textarea
                  className="min-h-[90px] w-full resize-none rounded-2xl border border-zinc-200 p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
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
    document.body
  );
};

export default TaskDetailModal;
