import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { getMyRoleIn } from "../../../shared/api/memberships";
import { hasTrainingManagementAccess } from "../../../shared/utils/access";
import type { RestaurantRole } from "../../../shared/types/restaurant";

export function useTrainingAccess() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (restaurantId == null) {
      setMyRole(null);
      setLoading(false);
      return;
    }

    if (hasTrainingManagementAccess(user?.roles)) {
      setMyRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const role = await getMyRoleIn(restaurantId);
        if (!cancelled) {
          setMyRole(role);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load membership role", error);
          setMyRole(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, user?.roles]);

  const canManage = useMemo(
    () => hasTrainingManagementAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  return { canManage, myRole, loading, restaurantId };
}
