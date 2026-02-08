import { Check, Trash } from "lucide-react";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import type { TaskDto } from "../api";
import {
  dueDateClassName,
  formatRelativeTaskDate,
  formatTaskDate,
  resolveTaskAssignee,
} from "../utils";

type TaskCardProps = {
  task: TaskDto;
  onOpen: (task: TaskDto) => void;
  onComplete: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
  canDelete: boolean;
};

const priorityStyles: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

const TaskCard = ({ task, onOpen, onComplete, onDelete, canDelete }: TaskCardProps) => {
  const badgeClass = priorityStyles[task.priority] ?? "bg-app text-muted";

  return (
    <Card
      className="cursor-pointer transition hover:shadow-[var(--staffly-shadow)]"
      onClick={() => onOpen(task)}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-strong">{task.title}</div>
            <div className="mt-1 text-xs text-muted">{resolveTaskAssignee(task)}</div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
            {task.priority}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted">
            <span className={`font-medium ${dueDateClassName(task.dueDate)}`}>
              {formatTaskDate(task.dueDate)}
            </span>
            {task.dueDate && (
              <span className="ml-2 text-xs text-muted">
                {formatRelativeTaskDate(task.dueDate)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.status !== "COMPLETED" && (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                aria-label="Выполнено"
                onClick={(event) => {
                  event.stopPropagation();
                  onComplete(task);
                }}
              >
                <Icon icon={Check} size="sm" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                aria-label="Удалить"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(task);
                }}
              >
                <Icon icon={Trash} size="sm" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TaskCard;
