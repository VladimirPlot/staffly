import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type NotificationAuthorDto = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type NotificationPositionDto = {
  id: number;
  name: string;
  active: boolean;
  level?: RestaurantRole;
};

export type NotificationDto = {
  id: number;
  restaurantId: number;
  content: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: NotificationAuthorDto;
  positions: NotificationPositionDto[];
};

export type NotificationRequest = {
  content: string;
  expiresAt: string;
  positionIds: number[];
};

export async function listNotifications(restaurantId: number): Promise<NotificationDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/notifications`);
  return data as NotificationDto[];
}

export async function createNotification(
  restaurantId: number,
  payload: NotificationRequest,
): Promise<NotificationDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/notifications`, payload);
  return data as NotificationDto;
}

export async function updateNotification(
  restaurantId: number,
  notificationId: number,
  payload: NotificationRequest,
): Promise<NotificationDto> {
  const { data } = await api.put(
    `/api/restaurants/${restaurantId}/notifications/${notificationId}`,
    payload,
  );
  return data as NotificationDto;
}

export async function deleteNotification(
  restaurantId: number,
  notificationId: number,
): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/notifications/${notificationId}`);
}
