import api from "../../shared/api/apiClient";

export type ContactDto = {
  id: number;
  restaurantId: number;
  name: string;
  description?: string | null;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactRequest = {
  name: string;
  description?: string | null;
  phone: string;
};

export async function listContacts(restaurantId: number): Promise<ContactDto[]> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/contacts`);
  return data as ContactDto[];
}

export async function createContact(
  restaurantId: number,
  payload: ContactRequest,
): Promise<ContactDto> {
  const { data } = await api.post(`/api/restaurants/${restaurantId}/contacts`, payload);
  return data as ContactDto;
}

export async function updateContact(
  restaurantId: number,
  contactId: number,
  payload: ContactRequest,
): Promise<ContactDto> {
  const { data } = await api.put(`/api/restaurants/${restaurantId}/contacts/${contactId}`, payload);
  return data as ContactDto;
}

export async function deleteContact(restaurantId: number, contactId: number): Promise<void> {
  await api.delete(`/api/restaurants/${restaurantId}/contacts/${contactId}`);
}
