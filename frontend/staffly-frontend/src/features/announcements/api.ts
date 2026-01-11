import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type AnnouncementAuthorDto = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
} | null;

export type AnnouncementPositionDto = {
  id: number;
  name: string;
  active: boolean;
  level?: RestaurantRole;
};

export type AnnouncementDto = {
  id: number;
  content: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: AnnouncementAuthorDto;
  positions: AnnouncementPositionDto[];
};

export type AnnouncementRequest = {
  content: string;
  expiresAt?: string | null;
  positionIds: number[];
};

export async function listAnnouncements(restaurantId: number): Promise<AnnouncementDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/announcements`);
  return data as AnnouncementDto[];
}

export async function createAnnouncement(
  restaurantId: number,
  payload: AnnouncementRequest,
): Promise<AnnouncementDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/announcements`, payload);
  return data as AnnouncementDto;
}

export async function updateAnnouncement(
  restaurantId: number,
  announcementId: number,
  payload: AnnouncementRequest,
): Promise<AnnouncementDto> {
  const { data } = await api.put(
    `/api/restaurants/${restaurantId}/announcements/${announcementId}`,
    payload,
  );
  return data as AnnouncementDto;
}

export async function deleteAnnouncement(
  restaurantId: number,
  announcementId: number,
): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/announcements/${announcementId}`);
}
