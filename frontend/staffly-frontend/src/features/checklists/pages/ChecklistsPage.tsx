import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import RestaurantChecklists from "../components/RestaurantChecklists";

const ChecklistsPage = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") === "scripts" ? "scripts" : "checklists";

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

  const pageTitle = activeTab === "scripts" ? "Скрипты" : "Чек-листы";
  const createLabel = activeTab === "scripts" ? "Создать скрипт" : "Создать чек-лист";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Верхняя строка: назад + табы */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <BackToHome />

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeTab === "checklists" ? "primary" : "outline"}
            onClick={() => setSearchParams({ tab: "checklists" })}
          >
            Чек-листы
          </Button>
          <Button
            size="sm"
            variant={activeTab === "scripts" ? "primary" : "outline"}
            onClick={() => setSearchParams({ tab: "scripts" })}
          >
            Скрипты
          </Button>
        </div>
      </div>

      {/* Заголовок + кнопка создать */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{pageTitle}</h2>
          <div className="text-sm text-muted">
            {activeTab === "scripts"
              ? "Готовые инструкции для сотрудников по должностям"
              : "Готовые чек-листы для сотрудников по должностям"}
          </div>
        </div>

        {access.isManagerLike && (
          <Button onClick={() => window.dispatchEvent(new Event("open-checklist-dialog"))}>
            {createLabel}
          </Button>
        )}
      </div>

      <RestaurantChecklists
        restaurantId={restaurantId}
        canManage={access.isManagerLike}
      />
    </div>
  );
};

export default ChecklistsPage;
