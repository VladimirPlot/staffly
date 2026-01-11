import api from "../../shared/api/apiClient";

export type InboxMessageType = "BIRTHDAY" | "EVENT" | "ANNOUNCEMENT";
export type InboxEventSubtype = "SCHEDULE_DECISION" | null;

export type InboxAuthorDto = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
} | null;

export type InboxMessageDto = {
  id: number;
  type: InboxMessageType;
  eventSubtype?: InboxEventSubtype;
  content: string;
  expiresAt?: string | null;
  createdAt: string;
  createdBy?: InboxAuthorDto;
  isRead: boolean;
  isArchived: boolean;
  isExpired: boolean;
};

export type InboxPageDto = {
  items: InboxMessageDto[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export type InboxUnreadCountDto = {
  count: number;
  eventCount: number;
  scheduleEventCount: number;
};

export type InboxMarkerDto = {
  hasScheduleEvents: boolean;
};

export type InboxTab = "BIRTHDAY" | "EVENT" | "ANNOUNCEMENT";
export type InboxView = "UNREAD" | "ALL" | "ARCHIVED";

export async function fetchInbox(
  restaurantId: number,
  params: { tab: InboxTab; view: InboxView; page?: number; size?: number },
): Promise<InboxPageDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inbox`, { params });
  return data as InboxPageDto;
}

export async function fetchInboxUnreadCount(
  restaurantId: number,
): Promise<InboxUnreadCountDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inbox/unread-count`);
  return data as InboxUnreadCountDto;
}

export async function fetchInboxMarkers(restaurantId: number): Promise<InboxMarkerDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/inbox/markers`);
  return data as InboxMarkerDto;
}

export async function markInboxRead(restaurantId: number, messageId: number): Promise<void> {
  await api.post(`/api/restaurants/${restaurantId}/inbox/${messageId}/read`);
}

export async function archiveInboxMessage(
  restaurantId: number,
  messageId: number,
): Promise<void> {
  await api.post(`/api/restaurants/${restaurantId}/inbox/${messageId}/archive`);
}
