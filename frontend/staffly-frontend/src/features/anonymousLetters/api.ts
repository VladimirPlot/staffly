import api from "../../shared/api/apiClient";

export type AnonymousLetterSummaryDto = {
  id: number;
  subject: string;
  createdAt: string;
  readAt?: string | null;
  recipientName?: string | null;
  recipientPosition?: string | null;
};

export type AnonymousLetterDto = AnonymousLetterSummaryDto & {
  content: string;
};

export type AnonymousLetterRequest = {
  subject: string;
  recipientMemberId: number;
  content: string;
};

export type UnreadLettersDto = {
  hasUnread: boolean;
};

export async function listAnonymousLetters(
  restaurantId: number,
): Promise<AnonymousLetterSummaryDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/anonymous-letters`);
  return data as AnonymousLetterSummaryDto[];
}

export async function getAnonymousLetter(
  restaurantId: number,
  letterId: number,
): Promise<AnonymousLetterDto> {
  const { data } = await api.get(
    `/api/restaurants/${restaurantId}/anonymous-letters/${letterId}`,
  );
  return data as AnonymousLetterDto;
}

export async function createAnonymousLetter(
  restaurantId: number,
  payload: AnonymousLetterRequest,
): Promise<AnonymousLetterDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/anonymous-letters`, payload);
  return data as AnonymousLetterDto;
}

export async function fetchUnreadAnonymousLetters(
  restaurantId: number,
): Promise<UnreadLettersDto> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/anonymous-letters/unread`);
  return data as UnreadLettersDto;
}
