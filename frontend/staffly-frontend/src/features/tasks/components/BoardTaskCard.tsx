import { Check, Clock3, Users } from "lucide-react";
import Button from "../../../shared/ui/Button";
import type { TaskDto } from "../api";
import {
  dueDateClassName,
  formatRelativeTaskDate,
  formatTaskDate,
  formatTaskInstant,
  isTaskOverdue,
  priorityLabels,
  resolveTaskAssignee,
} from "../utils";

type Props = {
  task: TaskDto;
  today: string;
  now?: Date;
  layout: "grid" | "list";
  busy: boolean;
  onOpen: () => void;
  onComplete: () => void;
};
export default function BoardTaskCard({ task, today, now, layout, busy, onOpen, onComplete }: Props) {
  const done = task.status === "COMPLETED";
  const compact = layout === "list";
  const overdue = isTaskOverdue(task, now);
  const deadline = done
    ? `Выполнено · ${formatTaskInstant(task.completedAt, task.timezone)}`
    : `${formatTaskDate(task.dueDate)}${task.dueTime ? " · " + task.dueTime.slice(0, 5) : ""} · ${overdue && task.dueDate === today ? "просрочено" : formatRelativeTaskDate(task.dueDate, today)}`;
  return (
    <article
      className={`border-subtle bg-surface relative rounded-2xl border transition-shadow hover:shadow-[var(--staffly-shadow)] ${compact ? "p-3" : "flex flex-col p-4"}`}
    >
      <span
        className={`pointer-events-none absolute ${compact ? "top-3 right-3" : "top-4 right-4"} rounded-full px-2 py-1 text-[11px] ${task.priority === "HIGH" ? "bg-red-500/10 text-red-600" : "bg-app text-muted"}`}
      >
        {priorityLabels[task.priority]}
      </span>
      <button
        onClick={onOpen}
        className="flex w-full min-w-0 flex-1 flex-col items-start justify-start rounded-lg text-left focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:outline-none"
      >
        <h4
          className={`text-strong w-full pr-20 font-semibold [overflow-wrap:anywhere] break-words ${compact ? "line-clamp-2 text-sm" : "text-base"}`}
        >
          {task.title}
        </h4>
        <p className={`text-muted flex w-full items-center gap-1.5 text-xs ${compact ? "mt-1 pr-10" : "mt-2"}`}>
          <Users size={compact ? 12 : 14} className="shrink-0" />
          <span className={compact ? "truncate" : ""}>{resolveTaskAssignee(task)}</span>
        </p>
        {task.completionMode === "EACH" && !compact && (
          <div className="mt-3 w-full">
            <div className="flex justify-between text-xs">
              <span className={task.myCompleted ? "" : "sr-only"}>
                {task.myCompleted ? "Вы выполнили" : "Выполнение каждым"}
              </span>
              <span className="ml-auto">
                {task.completedCount} / {task.participantCount}
              </span>
            </div>
            <progress
              className="mt-1 h-1.5 w-full accent-emerald-600"
              value={task.completedCount}
              max={Math.max(task.participantCount, 1)}
              aria-label="Прогресс выполнения"
            />
          </div>
        )}
        <div
          className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs ${compact ? "mt-2 pr-10" : "mt-3"}`}
        >
          <p
            className={`flex items-center gap-1.5 ${done ? "text-emerald-600" : overdue ? "text-red-600" : dueDateClassName(task.dueDate, today)}`}
          >
            <Clock3 size={compact ? 12 : 14} className="shrink-0" />
            {deadline}
          </p>
          {compact && task.completionMode === "EACH" && (
            <span className={task.myCompleted ? "text-emerald-600" : "text-muted"} aria-label="Прогресс выполнения">
              {task.completedCount} / {task.participantCount}
              {task.myCompleted ? " · Вы выполнили" : ""}
            </span>
          )}
        </div>
      </button>
      {!done && (task.canComplete || (task.myCompleted && !compact) || !task.participantCount) && (
        <div
          className={
            compact && task.canComplete && !task.myCompleted
              ? "absolute right-3 bottom-3"
              : compact
                ? "mt-2 text-xs"
                : "border-subtle mt-3 border-t pt-3"
          }
        >
          {task.myCompleted ? (
            !compact && <span className="text-xs text-emerald-600">Ваш результат сохранён · ожидаем остальных</span>
          ) : task.canComplete ? (
            <Button
              size={compact ? "icon" : "sm"}
              className={compact ? "h-8 w-8 rounded-xl" : ""}
              variant="outline"
              onClick={onComplete}
              disabled={busy}
              aria-label={task.completionMode === "EACH" ? "Я выполнил" : "Выполнить"}
              leftIcon={<Check size={15} />}
            >
              {compact ? null : task.completionMode === "EACH" ? "Я выполнил" : "Выполнить"}
            </Button>
          ) : (
            <span className="text-muted text-xs">Нужно назначить исполнителей</span>
          )}
        </div>
      )}
    </article>
  );
}
