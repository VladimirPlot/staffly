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

export function diffTaskDays(dateStr?: string | null, todayIso = restaurantToday("Europe/Moscow")): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const target = new Date(year, month - 1, day);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatRelativeTaskDate(dateStr?: string | null, todayIso?: string): string {
  const days = diffTaskDays(dateStr, todayIso);
  if (days === null) return "";
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days > 1) return `через ${days} дн.`;
  return `просрочено на ${Math.abs(days)} дн.`;
}

export function dueDateClassName(dateStr?: string | null, todayIso?: string): string {
  const days = diffTaskDays(dateStr, todayIso);
  if (days === null) return "text-muted";
  if (days < 0) return "text-red-600";
  if (days <= 3) return "text-yellow-600";
  return "text-muted";
}

export function isOverdue(dateStr?: string | null, todayIso?: string): boolean {
  const days = diffTaskDays(dateStr, todayIso);
  return days !== null && days < 0;
}

export function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null,
): string {
  if (fullName?.endsWith(" (исключен)")) return fullName;
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }
  return fullName || "—";
}

export function resolveTaskAssignee(task: TaskDto): string {
  if (task.participantCount != null) {
    if (task.participantCount === 0) return "Без исполнителей";
    if (task.audience === "ALL") return "Все сотрудники";
    const names = task.participants.filter((p) => p.active).map((p) => p.name);
    return names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} и ещё ${names.length - 2}`;
  }
  if (task.assignedToAll) return "Всем";
  if (task.assignedUser) {
    const person = formatPersonName(
      task.assignedUser.firstName,
      task.assignedUser.lastName,
      task.assignedUser.fullName,
    );
    if (task.assignedUser.positionName) {
      return `${task.assignedUser.positionName} · ${person}`;
    }
    return person;
  }
  if (task.assignedPosition) {
    return task.assignedPosition.name;
  }
  return "Без исполнителя";
}

export function isUnassignedTask(task: TaskDto): boolean {
  if (task.participantCount != null) return task.status === "ACTIVE" && task.participantCount === 0;
  return task.status === "ACTIVE" && !task.assignedToAll && !task.assignedUser && !task.assignedPosition;
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

export const priorityLabels = { HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" };
export function isTaskOverdue(task: TaskDto, now = new Date()): boolean {
  if (task.status !== "ACTIVE" || !task.dueDate) return false;
  const today = restaurantToday(task.timezone, now);
  if (task.dueDate !== today) return task.dueDate < today;
  if (!task.dueTime) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: task.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const localTime = ["hour", "minute"].map((key) => parts.find((p) => p.type === key)!.value).join(":");
  return localTime >= task.dueTime.slice(0, 5);
}
export function restaurantToday(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((key) => parts.find((p) => p.type === key)!.value).join("-");
}
export function formatTaskInstant(value?: string | null, timezone = "Europe/Moscow"): string {
  if (!value) return "—";
  const instant = value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : value + "Z";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}
export type TaskPeriod = "TODAY" | "WEEK" | "ALL";
export function nearestTaskPeriod(tasks: TaskDto[], today: string): TaskPeriod {
  const pending = tasks.filter((task) => task.status === "ACTIVE");
  if (pending.some((task) => inTaskPeriod(task, "TODAY", today))) return "TODAY";
  if (pending.some((task) => inTaskPeriod(task, "WEEK", today))) return "WEEK";
  return "ALL";
}
export function inTaskPeriod(task: TaskDto, period: TaskPeriod, today: string): boolean {
  if (period === "ALL") return true;
  const date =
    task.status === "COMPLETED" && task.completedAt
      ? restaurantToday(task.timezone, new Date(task.completedAt))
      : task.dueDate;
  const days = diffTaskDays(date, today);
  return days != null && (task.status === "COMPLETED" ? days >= 0 : true) && days <= (period === "TODAY" ? 0 : 6);
}

export function sortTasks(tasks: TaskDto[]): TaskDto[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    const aDate = a.dueDate ? new Date(a.dueDate) : null;
    const bDate = b.dueDate ? new Date(b.dueDate) : null;
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });
}
