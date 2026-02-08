import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import BackToHome from "../../../shared/ui/BackToHome";
import PageLoader from "../../../shared/ui/PageLoader";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import AnnouncementsManager from "../AnnouncementsManager";

const AnnouncementsPage = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);
  const [loadingRole, setLoadingRole] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setMyRole(null);
      setLoadingRole(false);
      return () => {
        alive = false;
      };
    }

    setLoadingRole(true);
    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (!alive) return;
        setMyRole(role);
        setLoadingRole(false);
      } catch {
        if (!alive) return;
        setMyRole(null);
        setLoadingRole(false);
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

  const canManageAnnouncements = access.isManagerLike;

  if (!restaurantId) return null;

  if (!loadingRole && !canManageAnnouncements) {
    return <Navigate to="/app" replace />;
  }

  if (loadingRole) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <h2 className="text-2xl font-semibold">Объявления</h2>
      <p className="mb-4 text-sm text-muted">
        Сообщения руководства для сотрудников по должностям.
      </p>

      <AnnouncementsManager restaurantId={restaurantId} canManage={canManageAnnouncements} />
    </div>
  );
};

export default AnnouncementsPage;
