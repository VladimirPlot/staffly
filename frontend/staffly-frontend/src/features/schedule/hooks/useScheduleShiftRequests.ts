import React from "react";

import {
  cancelShiftRequest,
  decideAsManager,
  fetchSchedule,
  listSavedSchedules,
  listShiftRequests,
  type ScheduleSummary,
  type ShiftRequestDto,
} from "../api";
import type { MemberDto } from "../../employees/api";
import type { ScheduleData } from "../types";

type UseScheduleShiftRequestsParams = {
  restaurantId: number | null;
  scheduleId: number | null;
  currentMember: MemberDto | null;
  canManage: boolean;
  onClearScheduleNotices: () => void;
  onScheduleUpdated: (schedule: ScheduleData) => void;
  onSavedSchedulesUpdated: (schedules: ScheduleSummary[]) => void;
  onSuccessMessage: (message: string) => void;
  onErrorMessage: (message: string) => void;
};

export default function useScheduleShiftRequests({
  restaurantId,
  scheduleId,
  currentMember,
  canManage,
  onClearScheduleNotices,
  onScheduleUpdated,
  onSavedSchedulesUpdated,
  onSuccessMessage,
  onErrorMessage,
}: UseScheduleShiftRequestsParams) {
  const [requests, setRequests] = React.useState<ShiftRequestDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (targetScheduleId?: number | null) => {
      const scheduleForLoad = targetScheduleId ?? scheduleId;
      if (!restaurantId || !scheduleForLoad) {
        setRequests([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await listShiftRequests(restaurantId, scheduleForLoad);
        setRequests(data);
      } catch (e: any) {
        setError(e?.friendlyMessage || "Не удалось загрузить заявки");
        setRequests([]);
      } finally {
        setLoading(false);
      }
    },
    [restaurantId, scheduleId],
  );

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  React.useEffect(() => {
    if (!restaurantId || !scheduleId) {
      setRequests([]);
      setError(null);
      setLoading(false);
    }
  }, [restaurantId, scheduleId]);

  const humanStatus = React.useCallback((status: ShiftRequestDto["status"]) => {
    switch (status) {
      case "PENDING_MANAGER":
        return "Ожидает решения менеджера";
      case "APPROVED":
        return "Одобрено";
      case "REJECTED_BY_MANAGER":
        return "Отклонено";
      default:
        return status;
    }
  }, []);

  const canCancelOwnRequest = React.useCallback(
    (request: ShiftRequestDto) => {
      if (!currentMember) return false;
      if (request.status !== "PENDING_MANAGER") return false;
      return request.fromMember.id === currentMember.id;
    },
    [currentMember],
  );

  const decide = React.useCallback(
    async (requestId: number, accepted: boolean) => {
      if (!restaurantId || !scheduleId) return;
      onClearScheduleNotices();
      try {
        await decideAsManager(restaurantId, scheduleId, requestId, accepted);
        const updatedSchedule = await fetchSchedule(restaurantId, scheduleId);
        onScheduleUpdated(updatedSchedule);
        await load(scheduleId);
        onSuccessMessage(accepted ? "Заявка одобрена" : "Заявка отклонена");
      } catch (e: any) {
        onErrorMessage(e?.friendlyMessage || "Не удалось обработать заявку");
      }
    },
    [load, onClearScheduleNotices, onErrorMessage, onScheduleUpdated, onSuccessMessage, restaurantId, scheduleId],
  );

  const cancel = React.useCallback(
    async (requestId: number) => {
      if (!restaurantId || !scheduleId) return;
      onClearScheduleNotices();
      try {
        await cancelShiftRequest(restaurantId, scheduleId, requestId);
        await refresh();
        const savedList = await listSavedSchedules(restaurantId);
        onSavedSchedulesUpdated(savedList);
        onSuccessMessage("Заявка отменена");
      } catch (e: any) {
        onErrorMessage(e?.friendlyMessage || "Не удалось отменить заявку");
      }
    },
    [
      onClearScheduleNotices,
      onErrorMessage,
      onSavedSchedulesUpdated,
      onSuccessMessage,
      refresh,
      restaurantId,
      scheduleId,
    ],
  );

  const sortedRequests = React.useMemo(() => {
    let nextRequests = [...requests];
    if (!canManage && currentMember) {
      nextRequests = nextRequests.filter(
        (request) => request.fromMember.id === currentMember.id || request.toMember.id === currentMember.id,
      );
    }
    return nextRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [canManage, currentMember, requests]);

  return {
    requests,
    sortedRequests,
    loading,
    error,
    load,
    refresh,
    humanStatus,
    canCancelOwnRequest,
    decide,
    cancel,
  };
}
