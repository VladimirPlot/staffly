import type { TaskDto } from "./api";

export function formatTaskDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function diffTaskDays(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatRelativeTaskDate(dateStr?: string | null): string {
  const days = diffTaskDays(dateStr);
  if (days === null) return "";
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days > 1) return `через ${days} дн.`;
  return `просрочено на ${Math.abs(days)} дн.`;
}

export function dueDateClassName(dateStr?: string | null): string {
  const days = diffTaskDays(dateStr);
  if (days === null) return "text-zinc-600";
  if (days < 0) return "text-red-600";
  if (days <= 3) return "text-yellow-600";
  return "text-zinc-600";
}

export function isOverdue(dateStr?: string | null): boolean {
  const days = diffTaskDays(dateStr);
  return days !== null && days < 0;
}

export function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null
): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }
  return fullName || "—";
}

export function resolveTaskAssignee(task: TaskDto): string {
  if (task.assignedToAll) return "Всем";
  if (task.assignedUser) {
    const person = formatPersonName(
      task.assignedUser.firstName,
      task.assignedUser.lastName,
      task.assignedUser.fullName
    );
    if (task.assignedUser.positionName) {
      return `${task.assignedUser.positionName} · ${person}`;
    }
    return person;
  }
  if (task.assignedPosition) {
    return task.assignedPosition.name;
  }
  return "Без ответственного";
}

export function formatCompletedAt(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const priorityOrder: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export function sortTasks(tasks: TaskDto[]): TaskDto[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff =
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    const aDate = a.dueDate ? new Date(a.dueDate) : null;
    const bDate = b.dueDate ? new Date(b.dueDate) : null;
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });
}
