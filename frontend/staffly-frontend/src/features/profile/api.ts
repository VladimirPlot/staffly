import api from "../../shared/api/apiClient";

export type UserProfile = {
  id: number;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate?: string | null;
};

export type UpdateUserRequest = Partial<{
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string | null;
}>;

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await api.get("/api/users/me");
  return data as UserProfile;
}

export async function updateMyProfile(payload: UpdateUserRequest): Promise<UserProfile> {
  const { data } = await api.patch("/api/users/me", payload);
  return data as UserProfile;
}

export async function changeMyPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.post("/api/users/me/change-password", payload);
}

/** ВАЖНО: не задаём Content-Type вручную — Axios сам проставит boundary */
export async function uploadMyAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/users/me/avatar", form);
  if (!data?.avatarUrl) throw new Error("Avatar upload failed");
  return data;
}
