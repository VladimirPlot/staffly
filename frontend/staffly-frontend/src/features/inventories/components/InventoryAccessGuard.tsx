import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import PageLoader from "../../../shared/ui/PageLoader";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { fetchMyRoleIn } from "../../employees/api";

type Props = {
  children: ReactNode;
};

export default function InventoryAccessGuard({ children }: Props) {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(!!restaurantId);

  useEffect(() => {
    if (!restaurantId) {
      setMyRole(null);
      setRoleLoading(false);
      return;
    }

    let alive = true;
    setRoleLoading(true);
    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (alive) setMyRole(role);
      } catch {
        if (alive) setMyRole(null);
      } finally {
        if (alive) setRoleLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const access = useMemo(() => resolveRestaurantAccess(user?.roles, myRole), [myRole, user?.roles]);

  if (!restaurantId) {
    return null;
  }

  if (roleLoading) {
    return <PageLoader />;
  }

  if (!access.isManagerLike) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
