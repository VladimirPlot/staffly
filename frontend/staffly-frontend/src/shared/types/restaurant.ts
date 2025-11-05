export type RestaurantRole = "ADMIN" | "MANAGER" | "STAFF";

export function normalizeRestaurantRole(role: string | null | undefined): RestaurantRole | null {
  if (!role) return null;
  const normalized = role.toString().toUpperCase().replace(/^ROLE_/, "");
  if (normalized === "ADMIN" || normalized === "MANAGER" || normalized === "STAFF") {
    return normalized as RestaurantRole;
  }
  return null;
}
