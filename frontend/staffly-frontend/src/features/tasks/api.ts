import api from "../../shared/api/apiClient";

export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "ACTIVE" | "COMPLETED";
export type TaskScope = "MINE" | "ALL";

export type TaskPositionDto = {
  id: number;
  name: string;
};

export type TaskUserDto = {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  positionId?: number | null;
  positionName?: string | null;
};

export type TaskDto = {
  id: number;
  version: number;
  restaurantId: number;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  assignedToAll: boolean;
  assignedPosition?: TaskPositionDto | null;
  assignedUser?: TaskUserDto | null;
  createdBy?: TaskUserDto | null;
  setter?: TaskUserDto | null;
  createdAt?: string | null;
  completionMode: "ANY" | "EACH";
  audience: "NONE" | "ALL" | "POSITIONS" | "MEMBERS";
  positionIds: number[];
  participants: TaskParticipant[];
  events: { id: number; actorName: string; text: string; createdAt: string }[];
  participantCount: number;
  completedCount: number;
  myCompleted: boolean;
  canComplete: boolean;
  timezone: string;
  restaurantToday: string;
  ownerMemberId: number;
  completedBy?: TaskUserDto | null;
  completionReason?: string | null;
};

export type TaskParticipant = {
  memberId: number;
  userId: number;
  name: string;
  positionName: string | null;
  active: boolean;
  completedAt: string | null;
};
export type TaskAudienceAction = "ADD" | "SKIP" | "RESTORE";
export type TaskAudienceDecision = { taskId: number; expectedVersion: number; action: TaskAudienceAction };
export type TaskOpportunity = {
  taskId: number;
  title: string;
  version: number;
  completionMode: "ANY" | "EACH";
  completedCount: number;
  participantCount: number;
  previousCompletedAt?: string | null;
  leaving: boolean;
};

export type TaskCreateRequest = {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate: string;
  dueTime?: string | null;
  assignedUserId?: number | null;
  assignedPositionId?: number | null;
  assignedToAll?: boolean;
  completionMode: TaskDto["completionMode"];
  audience: TaskDto["audience"];
  positionIds: number[];
  memberIds: number[];
  ownerMemberId?: number;
  expectedVersion?: number;
  confirmResetProgress?: boolean;
};

export type TaskCommentDto = {
  id: number;
  taskId: number;
  author: TaskUserDto | null;
  text: string;
  createdAt: string;
};

export type TaskCommentPageDto = {
  items: TaskCommentDto[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export type TaskCommentRequest = {
  text: string;
};

export async function listTasks(
  restaurantId: number,
  params?: { scope?: TaskScope; status?: TaskStatus; overdue?: boolean },
): Promise<TaskDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/tasks`, { params });
  return data as TaskDto[];
}

export async function createTask(restaurantId: number, payload: TaskCreateRequest): Promise<TaskDto> {
  const body = {
    ...payload,
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    priority: payload.priority,
    dueDate: payload.dueDate,
    assignedUserId: payload.assignedUserId ?? null,
    assignedPositionId: payload.assignedPositionId ?? null,
    assignedToAll: payload.assignedToAll ?? false,
  };
  const { data } = await api.post(`/api/restaurants/${restaurantId}/tasks`, body);
  return data as TaskDto;
}

export async function fetchTask(taskId: number): Promise<TaskDto> {
  const { data } = await api.get(`/api/tasks/${taskId}`);
  return data as TaskDto;
}

export async function updateTask(taskId: number, payload: TaskCreateRequest): Promise<TaskDto> {
  const { data } = await api.patch(`/api/tasks/${taskId}`, payload);
  return data;
}
export async function undoTaskCompletion(taskId: number): Promise<TaskDto> {
  const { data } = await api.patch(`/api/tasks/${taskId}/undo-completion`);
  return data;
}
export async function reopenTask(taskId: number, expectedVersion: number): Promise<TaskDto> {
  const { data } = await api.patch(`/api/tasks/${taskId}/reopen`, { expectedVersion });
  return data;
}

export async function completeTask(taskId: number): Promise<TaskDto> {
  const { data } = await api.patch(`/api/tasks/${taskId}/complete`);
  return data as TaskDto;
}

export async function assignTask(taskId: number, memberId: number, expectedVersion: number): Promise<TaskDto> {
  const { data } = await api.patch(`/api/tasks/${taskId}/assignee`, { memberId, expectedVersion });
  return data as TaskDto;
}

export async function deleteTask(taskId: number): Promise<void> {
  await api.delete(`/api/tasks/${taskId}`);
}

export async function listTaskComments(
  taskId: number,
  params?: { page?: number; size?: number },
): Promise<TaskCommentPageDto> {
  const { data } = await api.get(`/api/tasks/${taskId}/comments`, { params });
  return data as TaskCommentPageDto;
}

export async function createTaskComment(taskId: number, payload: TaskCommentRequest): Promise<TaskCommentDto> {
  const { data } = await api.post(`/api/tasks/${taskId}/comments`, {
    text: payload.text.trim(),
  });
  return data as TaskCommentDto;
}
