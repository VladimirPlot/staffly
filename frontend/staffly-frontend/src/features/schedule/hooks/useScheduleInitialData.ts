import React from "react";

import { listSavedSchedules, type ScheduleSummary } from "../api";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import { listPositions, type PositionDto, type RestaurantRole } from "../../dictionaries/api";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type UseScheduleInitialDataParams = {
  restaurantId: number | null;
  userRoles: string[] | undefined;
  onRestaurantMissing: () => void;
  onBeforeLoad: () => void;
};

export default function useScheduleInitialData({
  restaurantId,
  userRoles,
  onRestaurantMissing,
  onBeforeLoad,
}: UseScheduleInitialDataParams) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [members, setMembers] = React.useState<MemberDto[]>([]);
  const [savedSchedules, setSavedSchedules] = React.useState<ScheduleSummary[]>([]);
  const [reloadVersion, setReloadVersion] = React.useState(0);

  const reload = React.useCallback(() => {
    setReloadVersion((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setError("Не выбран ресторан");
      setMyRole(null);
      setPositions([]);
      setMembers([]);
      setSavedSchedules([]);
      onRestaurantMissing();
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setMyRole(null);
    setPositions([]);
    setMembers([]);
    setSavedSchedules([]);
    onBeforeLoad();

    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        const accessNow = resolveRestaurantAccess(userRoles, role);
        const [posList, memList, savedList] = await Promise.all([
          listPositions(restaurantId, { includeInactive: accessNow.isManagerLike }),
          listMembers(restaurantId),
          listSavedSchedules(restaurantId),
        ]);
        if (!alive) return;
        setMyRole(role);
        setPositions(posList);
        setMembers(memList);
        setSavedSchedules(savedList);
      } catch (e: unknown) {
        if (!alive) return;
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить данные"));
        setMyRole(null);
        setPositions([]);
        setMembers([]);
        setSavedSchedules([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [onBeforeLoad, onRestaurantMissing, restaurantId, reloadVersion, userRoles]);

  return {
    loading,
    error,
    myRole,
    positions,
    members,
    savedSchedules,
    setSavedSchedules,
    setMembers,
    setPositions,
    reload,
  };
}
