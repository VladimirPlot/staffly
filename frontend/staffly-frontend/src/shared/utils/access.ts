function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return role.toString().toUpperCase().replace(/^ROLE_/, "");
}

type MaybeRole = string | null | undefined;

function collectNormalizedRoles(roles?: Array<MaybeRole>): Set<string> {
  const result = new Set<string>();
  if (!roles) {
    return result;
  }
  roles.forEach((role) => {
    const normalized = normalizeRole(role);
    if (normalized) {
      result.add(normalized);
    }
  });
  return result;
}

export type RestaurantAccess = {
  isCreator: boolean;
  isAdminLike: boolean;
  isManagerLike: boolean;
  normalizedRestaurantRole: string | null;
};

function resolveRestaurantAccessInternal(
  roles?: Array<MaybeRole>,
  restaurantRole?: MaybeRole
): RestaurantAccess {
  const normalizedRestaurantRole = normalizeRole(restaurantRole);
  const normalizedRoles = collectNormalizedRoles(roles);

  const isCreator = normalizedRoles.has("CREATOR");
  const isAdminLike =
    isCreator ||
    normalizedRoles.has("ADMIN") ||
    normalizedRoles.has("SUPER_ADMIN") ||
    normalizedRestaurantRole === "ADMIN";
  const isManagerLike =
    isAdminLike ||
    normalizedRoles.has("MANAGER") ||
    normalizedRoles.has("SUPERVISOR") ||
    normalizedRestaurantRole === "MANAGER";

  return {
    isCreator,
    isAdminLike,
    isManagerLike,
    normalizedRestaurantRole,
  };
}

export function resolveRestaurantAccess(
  roles?: Array<MaybeRole>,
  restaurantRole?: MaybeRole
): RestaurantAccess {
  return resolveRestaurantAccessInternal(roles, restaurantRole);
}

function hasManagementAccess(
  roles?: Array<MaybeRole>,
  restaurantRole?: MaybeRole
): boolean {
  return resolveRestaurantAccessInternal(roles, restaurantRole).isManagerLike;
}

export function hasTrainingManagementAccess(
  roles?: Array<string | null | undefined>,
  restaurantRole?: string | null | undefined
): boolean {
  return hasManagementAccess(roles, restaurantRole);
}

export function hasRestaurantManagementAccess(
  roles?: Array<string | null | undefined>,
  restaurantRole?: string | null | undefined
): boolean {
  return hasManagementAccess(roles, restaurantRole);
}
