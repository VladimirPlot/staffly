import type { RestaurantRole } from "../../../shared/types/restaurant";
import type { TrainingFolderDto } from "../api/types";

export const trainingRoleLabels: Record<RestaurantRole, string> = {
  STAFF: "STAFF — сотрудники",
  MANAGER: "MANAGER — менеджеры",
  ADMIN: "ADMIN — администраторы",
};

export function trainingPreparationAccess(role: RestaurantRole): string {
  if (role === "STAFF") return "MANAGER, ADMIN, EXAMINER и CREATOR";
  if (role === "MANAGER") return "ADMIN, EXAMINER и CREATOR";
  return "EXAMINER и CREATOR";
}

export function folderRoleLabel(folder: TrainingFolderDto): string | null {
  return folder.type !== "KNOWLEDGE" && folder.targetRole ? `Для проверки ${folder.targetRole}` : null;
}

export function folderMatchesPositionRole(folder: TrainingFolderDto, role: RestaurantRole | undefined): boolean {
  return folder.targetRole != null && folder.targetRole === role;
}
