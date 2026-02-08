import { useEffect, useMemo, useState } from "react";
import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import RestaurantChecklists from "../components/RestaurantChecklists";

const ChecklistsPage = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setMyRole(null);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (alive) setMyRole(role);
      } catch {
        if (alive) setMyRole(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const access = useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );

  if (!restaurantId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <h2 className="mb-4 text-2xl font-semibold">Чек-листы</h2>
      <div>
        <div className="text-sm text-muted">Готовые инструкции для сотрудников по должностям</div>
      </div>
      <RestaurantChecklists restaurantId={restaurantId} canManage={access.isManagerLike} />
    </div>
  );
};

export default ChecklistsPage;
