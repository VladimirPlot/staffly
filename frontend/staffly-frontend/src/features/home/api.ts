import api from "../../shared/api/apiClient";

export type DashboardLayoutResponse = {
  layout: string[];
};

export async function fetchDashboardLayout(
  restaurantId: number
): Promise<DashboardLayoutResponse> {
  const { data } = await api.get(`/api/restaurants/${restaurantId}/dashboard/layout`);
  return data;
}

export async function saveDashboardLayout(
  restaurantId: number,
  layout: string[]
): Promise<DashboardLayoutResponse> {
  const { data } = await api.put(`/api/restaurants/${restaurantId}/dashboard/layout`, { layout });
  return data;
}
