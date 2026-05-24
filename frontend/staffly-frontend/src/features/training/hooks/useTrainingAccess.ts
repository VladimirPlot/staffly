import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { getMyMembershipIn } from "../../../shared/api/memberships";
import { hasTrainingManagementAccess } from "../../../shared/utils/access";
import type { RestaurantRole } from "../../../shared/types/restaurant";

export function useTrainingAccess() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);
  const [isTrainingExaminer, setIsTrainingExaminer] = useState(false);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (restaurantId == null) {
      setMyRole(null);
      setIsTrainingExaminer(false);
      setSpecializations([]);
      setLoading(false);
      return;
    }

    if (hasTrainingManagementAccess(user?.roles)) {
      setMyRole(null);
      setSpecializations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const membership = await getMyMembershipIn(restaurantId);
        if (!cancelled) {
          const resolvedSpecializations = membership?.specializations ?? [];
          setMyRole(membership?.role ?? null);
          setSpecializations(resolvedSpecializations);
          setIsTrainingExaminer(resolvedSpecializations.includes("EXAMINER"));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load membership role", error);
          setMyRole(null);
          setSpecializations([]);
          setIsTrainingExaminer(false);
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
    () => hasTrainingManagementAccess(user?.roles, myRole, specializations),
    [user?.roles, myRole, specializations]
  );

  return { canManage, myRole, isTrainingExaminer, specializations, loading, restaurantId };
}
