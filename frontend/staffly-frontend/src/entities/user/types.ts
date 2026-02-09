export type MeResponse = {
  userId: number;
  phone: string;
  roles: string[];
  isCreator: boolean;
  restaurantId?: number;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  birthDate?: string | null;
  theme?: "light" | "dark";
};


export type UiUser = {
id: number;
phone: string;
name: string;
roles?: string[];
avatarUrl?: string;
theme?: "light" | "dark";
};
