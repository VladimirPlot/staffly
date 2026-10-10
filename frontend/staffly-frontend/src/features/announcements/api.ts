import api from "../../shared/api/apiClient";
import type { RestaurantRole } from "../../shared/types/restaurant";

export type AnnouncementAuthorDto = {
  id: number | null;
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

export type AnnouncementAudience = "ALL" | "POSITIONS" | "MEMBERS";

export type AnnouncementMemberDto = {
  id: number;
  name: string;
  positionId: number;
  positionName: string;
};

export type AnnouncementAudienceOptionsDto = {
  positions: AnnouncementPositionDto[];
  members: AnnouncementMemberDto[];
};

export type AnnouncementDto = {
  id: number;
  content: string;
  createdAt: string;
  createdBy?: AnnouncementAuthorDto;
  positions: AnnouncementPositionDto[];
  audience: AnnouncementAudience;
  recipientCount: number;
  recipients: AnnouncementMemberDto[];
};

export type AnnouncementRequest = {
  content: string;
  audience: AnnouncementAudience;
  positionIds: number[];
  memberIds: number[];
  operationId: string;
};

export type AnnouncementPageDto = {
  items: AnnouncementDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  timezone: string;
};

export async function fetchAnnouncementAudience(restaurantId: number): Promise<AnnouncementAudienceOptionsDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/announcements/audience`);
  return data as AnnouncementAudienceOptionsDto;
}

export async function listAnnouncements(restaurantId: number, page = 0): Promise<AnnouncementPageDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/announcements`, { params: { page } });
  return data as AnnouncementPageDto;
}

export async function createAnnouncement(restaurantId: number, payload: AnnouncementRequest): Promise<AnnouncementDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/announcements`, payload);
  return data as AnnouncementDto;
}

export async function deleteAnnouncement(restaurantId: number, announcementId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/announcements/${announcementId}`);
}
