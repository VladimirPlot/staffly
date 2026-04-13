import type { PositionDto } from "../../dictionaries/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import type { TrainingExamDto } from "../api/types";

const ROLE_ORDER: RestaurantRole[] = ["STAFF", "MANAGER", "ADMIN"];

function roleRank(role: RestaurantRole): number {
  return ROLE_ORDER.indexOf(role);
}

export function getManageableAudienceRoles(params: {
  isCreator: boolean;
  isExaminer: boolean;
  membershipRole: RestaurantRole | null;
}): RestaurantRole[] {
  if (params.isCreator || params.isExaminer) {
    return ROLE_ORDER;
  }

  if (params.membershipRole === "ADMIN") {
    return ["STAFF", "MANAGER"];
  }

  if (params.membershipRole === "MANAGER") {
    return ["STAFF"];
  }

  return [];
}

export function getManageablePositions(positions: PositionDto[], allowedRoles: RestaurantRole[]): PositionDto[] {
  const allowed = new Set(allowedRoles);
  return positions.filter((position) => allowed.has(position.level));
}

export function sortManageExams(
  exams: TrainingExamDto[],
  positionById: Map<number, PositionDto>,
): TrainingExamDto[] {
  return [...exams].sort((left, right) => {
    const leftPositions = left.visibilityPositionIds
      .map((id) => positionById.get(id))
      .filter((item): item is PositionDto => item != null);
    const rightPositions = right.visibilityPositionIds
      .map((id) => positionById.get(id))
      .filter((item): item is PositionDto => item != null);

    const leftRole = leftPositions[0]?.level ?? "STAFF";
    const rightRole = rightPositions[0]?.level ?? "STAFF";

    const byRole = roleRank(leftRole) - roleRank(rightRole);
    if (byRole !== 0) return byRole;

    const leftPositionName = leftPositions[0]?.name?.toLocaleLowerCase("ru") ?? "";
    const rightPositionName = rightPositions[0]?.name?.toLocaleLowerCase("ru") ?? "";
    if (leftPositionName !== rightPositionName) {
      return leftPositionName.localeCompare(rightPositionName, "ru");
    }

    return right.id - left.id;
  });
}

export function examTargetsAllowedAudience(
  exam: TrainingExamDto,
  positionById: Map<number, PositionDto>,
  allowedRoles: RestaurantRole[],
): boolean {
  if (allowedRoles.length === 0) return false;

  const allowed = new Set(allowedRoles);
  const targetLevels = exam.visibilityPositionIds
    .map((positionId) => positionById.get(positionId)?.level)
    .filter((level): level is RestaurantRole => level != null);

  if (targetLevels.length === 0) {
    return false;
  }

  return targetLevels.some((level) => allowed.has(level));
}
