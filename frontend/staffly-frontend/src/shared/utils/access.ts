export function hasTrainingManagementAccess(
  roles?: Array<string | null | undefined>
): boolean {
  if (!roles || roles.length === 0) {
    return false;
  }

  return roles.some((role) => {
    if (!role) return false;

    const normalized = role.toUpperCase().replace(/^ROLE_/, "");

    if (normalized === "CREATOR" || normalized === "ADMIN" || normalized === "MANAGER") {
      return true;
    }

    return normalized.includes("ADMIN") || normalized.includes("MANAGER");
  });
}
