function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return role.toString().toUpperCase().replace(/^ROLE_/, "");
}

function isAdminOrManager(normalizedRole: string | null): boolean {
  if (!normalizedRole) return false;
  if (normalizedRole === "ADMIN" || normalizedRole === "MANAGER") {
    return true;
  }
  return normalizedRole.includes("ADMIN") || normalizedRole.includes("MANAGER");
}

export function hasTrainingManagementAccess(
  roles?: Array<string | null | undefined>,
  restaurantRole?: string | null | undefined
): boolean {
  if (isAdminOrManager(normalizeRole(restaurantRole))) {
    return true;
  }

  if (!roles || roles.length === 0) {
    return false;
  }

  return roles.some((role) => {
    const normalized = normalizeRole(role);
    if (!normalized) return false;

    if (normalized === "CREATOR") {
      return true;
    }

    return isAdminOrManager(normalized);
  });
}
