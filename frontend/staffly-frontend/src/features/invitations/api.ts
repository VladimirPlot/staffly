import api from "../../shared/api/apiClient";

export type InviteRole = "ADMIN" | "MANAGER" | "STAFF";

export type MyInvite = {
  token: string;
  restaurantId: number;
  restaurantName: string;
  desiredRole: InviteRole;
  positionId?: number | null;
  positionName?: string | null;
  expiresAt: string;
};

export async function fetchMyInvites(): Promise<MyInvite[]> {
  const { data } = await api.get("/api/invitations/my");
  return data as MyInvite[];
}

export async function acceptInvite(token: string): Promise<void> {
  await api.post(`/api/invitations/${token}/accept`);
}

export async function declineInvite(token: string): Promise<void> {
  await api.post(`/api/invitations/${token}/decline`);
}

export type InviteEmployeePayload = {
  phoneOrEmail: string;     // именно phoneOrEmail (а не phone)
  role: InviteRole;
  positionId?: number;
};

export type InviteResponse = {
  token: string;
  restaurantId: number;
  desiredRole: InviteRole;
  positionId?: number;
  expiresAt: string;
};

export async function inviteEmployee(
  restaurantId: number,
  payload: InviteEmployeePayload
): Promise<InviteResponse> {
  const { data } = await api.post(
    `/api/restaurants/${restaurantId}/members/invite`,
    payload
  );
  return data as InviteResponse;
}
