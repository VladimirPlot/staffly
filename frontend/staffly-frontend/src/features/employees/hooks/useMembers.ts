import { useCallback, useEffect, useState } from "react";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../api";
import type { RestaurantRole } from "../../dictionaries/api";
import { getFriendlyEmployeeErrorMessage } from "../utils/errorMessages";

export function useMembers(restaurantId: number | null) {
  const [myRole, setMyRole] = useState<RestaurantRole | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const [role, data] = await Promise.all([fetchMyRoleIn(restaurantId), listMembers(restaurantId)]);
      setMyRole(role);
      setMembers(data);
    } catch (error: unknown) {
      setMembers([]);
      setError(getFriendlyEmployeeErrorMessage(error, "Не удалось загрузить участников"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);



  return {
    myRole,
    setMyRole,
    members,
    loading,
    error,
    refresh,
  };
}
