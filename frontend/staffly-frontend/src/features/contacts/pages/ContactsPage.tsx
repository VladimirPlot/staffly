import React from "react";
import { Navigate } from "react-router-dom";

import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import ContactsManager from "../components/ContactsManager";

const ContactsPage: React.FC = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);

  React.useEffect(() => {
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

  if (!restaurantId) {
    return null;
  }

  const access = resolveRestaurantAccess(user?.roles, myRole);

  if (!access.isManagerLike) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <h2 className="mb-4 text-2xl font-semibold">Контакты</h2>
      <ContactsManager restaurantId={restaurantId} />
    </div>
  );
};

export default ContactsPage;
