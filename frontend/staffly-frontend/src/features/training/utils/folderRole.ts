import type { RestaurantRole } from "../../../shared/types/restaurant";
import type { TrainingFolderDto } from "../api/types";

export const trainingRoleLabels: Record<RestaurantRole, string> = {
  STAFF: "STAFF — сотрудники",
  MANAGER: "MANAGER — менеджеры",
  ADMIN: "ADMIN — администраторы",
};

export function trainingPreparationAccess(role: RestaurantRole | null): string {
  if (role === "STAFF" || role == null) return "MANAGER, ADMIN и EXAMINER";
  if (role === "MANAGER") return "ADMIN и EXAMINER";
  return "EXAMINER";
}

export function folderRoleLabel(folder: TrainingFolderDto): string | null {
  if (folder.organizational) return "Без роли · Организационная папка";
  return folder.type !== "KNOWLEDGE" && folder.targetRole ? `Для проверки ${folder.targetRole}` : null;
}

export function folderMatchesPositionRole(folder: TrainingFolderDto, role: RestaurantRole | undefined): boolean {
  return Boolean(folder.organizational) || (folder.targetRole != null && folder.targetRole === role);
}
