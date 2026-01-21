import type { PositionDto } from "../../dictionaries/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";

const ROLE_SORT_ORDER: Record<RestaurantRole, number> = {
  ADMIN: 0,
  MANAGER: 1,
  STAFF: 2,
};

const getRoleOrder = (role: RestaurantRole | null | undefined) => {
  if (!role) return 99;
  return ROLE_SORT_ORDER[role] ?? 99;
};

export const comparePositions = (a?: PositionDto, b?: PositionDto) => {
  const roleDiff = getRoleOrder(a?.level) - getRoleOrder(b?.level);
  if (roleDiff !== 0) return roleDiff;
  const nameA = a?.name ?? "";
  const nameB = b?.name ?? "";
  return nameA.localeCompare(nameB, "ru", { sensitivity: "base" });
};
