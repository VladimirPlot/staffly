import { useCallback, useEffect, useState } from "react";
import {
  fetchMyRoleIn,
  listMembers,
  removeMember as removeMemberApi,
  updateMemberPosition,
  updateMemberRole,
  type MemberDto,
} from "../api";
import type { RestaurantRole } from "../../dictionaries/api";

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
      const [role, data] = await Promise.all([
        fetchMyRoleIn(restaurantId),
        listMembers(restaurantId),
      ]);
      setMyRole(role);
      setMembers(data);
    } catch (e: any) {
      setMembers([]);
      setError(e?.friendlyMessage || "Не удалось загрузить участников");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removeMember = useCallback(
    async (memberId: number) => {
      if (!restaurantId) return;
      await removeMemberApi(restaurantId, memberId);
      setMembers((prev) => prev.filter((member) => member.id !== memberId));
    },
    [restaurantId]
  );

  const patchMemberRole = useCallback(
    async (memberId: number, role: RestaurantRole) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      const updated = await updateMemberRole(restaurantId, memberId, role);
      setMembers((prev) => prev.map((member) => (member.id === updated.id ? { ...member, ...updated } : member)));
      return updated;
    },
    [restaurantId]
  );

  const patchMemberPosition = useCallback(
    async (memberId: number, positionId: number | null) => {
      if (!restaurantId) throw new Error("restaurantId is required");
      const updated = await updateMemberPosition(restaurantId, memberId, positionId);
      setMembers((prev) => prev.map((member) => (member.id === updated.id ? { ...member, ...updated } : member)));
      return updated;
    },
    [restaurantId]
  );

  return {
    myRole,
    setMyRole,
    members,
    loading,
    error,
    refresh,
    removeMember,
    patchMemberRole,
    patchMemberPosition,
  };
}
