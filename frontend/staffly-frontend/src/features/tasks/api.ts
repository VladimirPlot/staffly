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
  restaurantId: number;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  assignedToAll: boolean;
  assignedPosition?: TaskPositionDto | null;
  assignedUser?: TaskUserDto | null;
  createdBy?: TaskUserDto | null;
  createdAt?: string | null;
};

export type TaskCreateRequest = {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate: string;
  assignedUserId?: number | null;
  assignedPositionId?: number | null;
  assignedToAll?: boolean;
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
  params?: { scope?: TaskScope; status?: TaskStatus; overdue?: boolean }
): Promise<TaskDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/tasks`, { params });
  return data as TaskDto[];
}

export async function createTask(
  restaurantId: number,
  payload: TaskCreateRequest
): Promise<TaskDto> {
  const body = {
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

export async function completeTask(taskId: number): Promise<TaskDto> {
  const { data } = await api.patch(`/api/tasks/${taskId}/complete`);
  return data as TaskDto;
}

export async function deleteTask(taskId: number): Promise<void> {
  await api.delete(`/api/tasks/${taskId}`);
}

export async function listTaskComments(
  taskId: number,
  params?: { page?: number; size?: number }
): Promise<TaskCommentPageDto> {
  const { data } = await api.get(`/api/tasks/${taskId}/comments`, { params });
  return data as TaskCommentPageDto;
}

export async function createTaskComment(
  taskId: number,
  payload: TaskCommentRequest
): Promise<TaskCommentDto> {
  const { data } = await api.post(`/api/tasks/${taskId}/comments`, {
    text: payload.text.trim(),
  });
  return data as TaskCommentDto;
}
