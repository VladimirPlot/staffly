export type UiRestaurant = {
  id: number;
  name: string;
  city?: string;
  role: string;
  description?: string | null;
  timezone: string;
  locked: boolean;
};
