import { useEffect, useMemo, useState } from "react";
import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import RestaurantReminders from "../components/RestaurantReminders";

const RemindersPage = () => {
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
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Напоминания</h2>
        <div className="text-sm text-muted">
          Создавайте регулярные уведомления для команды и отдельных сотрудников.
        </div>
      </div>
      <RestaurantReminders
        restaurantId={restaurantId}
        canManage={access.isManagerLike}
        currentUserId={user?.id}
      />
    </div>
  );
};

export default RemindersPage;
