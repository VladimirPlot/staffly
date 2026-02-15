import type { MemberDto } from "../api";
import type { InviteRole } from "../../invitations/api";
import type { RestaurantRole } from "../../dictionaries/api";

export const ROLE_LABEL: Record<RestaurantRole, string> = {
  ADMIN: "Админ",
  MANAGER: "Менеджер",
  STAFF: "Сотрудник",
};

export const ROLE_PRIORITY: Record<RestaurantRole, number> = {
  ADMIN: 0,
  MANAGER: 1,
  STAFF: 2,
};

export function displayNameOf(member: MemberDto): string {
  if (member.fullName && member.fullName.trim()) return member.fullName.trim();
  const lastName = (member.lastName || "").trim();
  const firstName = (member.firstName || "").trim();
  const value = [lastName, firstName].filter(Boolean).join(" ").trim();
  return value || "Без имени";
}

export function formatBirthday(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function positionKeyOf(member: MemberDto): string | null {
  const label = (member.positionName ?? "").trim();
  if (member.positionId != null) return `id:${member.positionId}`;
  if (label) return `name:${label}`;
  return null;
}

export function allowedLevelsFor(role: InviteRole): RestaurantRole[] {
  switch (role) {
    case "ADMIN":
      return ["ADMIN", "MANAGER", "STAFF"];
    case "MANAGER":
      return ["MANAGER", "STAFF"];
    case "STAFF":
    default:
      return ["STAFF"];
  }
}

export function sortMembers(members: MemberDto[]): MemberDto[] {
  return [...members].sort((left, right) => {
    const roleDiff = ROLE_PRIORITY[left.role] - ROLE_PRIORITY[right.role];
    if (roleDiff !== 0) return roleDiff;

    const leftPosition = (left.positionName ?? "").trim();
    const rightPosition = (right.positionName ?? "").trim();
    const leftHasPosition = leftPosition.length > 0;
    const rightHasPosition = rightPosition.length > 0;

    if (leftHasPosition && rightHasPosition) {
      const positionCompare = leftPosition.localeCompare(rightPosition, "ru-RU", { sensitivity: "base" });
      if (positionCompare !== 0) return positionCompare;
    } else if (leftHasPosition !== rightHasPosition) {
      return leftHasPosition ? -1 : 1;
    }

    const leftName = displayNameOf(left).toLocaleLowerCase("ru-RU");
    const rightName = displayNameOf(right).toLocaleLowerCase("ru-RU");
    return leftName.localeCompare(rightName, "ru-RU");
  });
}
