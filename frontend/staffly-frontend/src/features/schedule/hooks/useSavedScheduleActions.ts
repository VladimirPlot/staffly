import React from "react";

import { deleteSchedule, fetchSchedule, listSavedSchedules, type ScheduleSummary } from "../api";
import type { ScheduleData } from "../types";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type ScheduleRange = { start: string; end: string } | null;

type UseSavedScheduleActionsParams = {
  restaurantId: number | null;
  canManage: boolean;
  scheduleId: number | null;
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  loadShiftRequests: (scheduleId?: number | null) => Promise<void>;
  onScheduleChanged: (schedule: ScheduleData | null) => void;
  onSavedSchedulesChanged: (items: ScheduleSummary[]) => void;
  onScheduleReadOnlyChanged: (value: boolean) => void;
  onLastRangeChanged: (value: ScheduleRange) => void;
  onClearScheduleNotices: () => void;
  onScheduleMessage: (message: string) => void;
  onScheduleError: (message: string | null) => void;
  onAutoTabReset: () => void;
};

export default function useSavedScheduleActions({
  restaurantId,
  canManage,
  scheduleId,
  prepareSchedule,
  loadShiftRequests,
  onScheduleChanged,
  onSavedSchedulesChanged,
  onScheduleReadOnlyChanged,
  onLastRangeChanged,
  onClearScheduleNotices,
  onScheduleMessage,
  onScheduleError,
  onAutoTabReset,
}: UseSavedScheduleActionsParams) {
  const [selectedSavedId, setSelectedSavedId] = React.useState<number | null>(null);
  const [scheduleLoading, setScheduleLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  React.useEffect(() => {
    setSelectedSavedId(null);
    setScheduleLoading(false);
    setDeletingId(null);
  }, [restaurantId]);

  React.useEffect(() => {
    if (scheduleId) {
      setSelectedSavedId(scheduleId);
    }
  }, [scheduleId]);

  const openSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!restaurantId) return;

      onAutoTabReset();
      setSelectedSavedId(id);
      onScheduleReadOnlyChanged(true);
      setScheduleLoading(true);
      onScheduleChanged(null);
      onClearScheduleNotices();
      try {
        const data = await fetchSchedule(restaurantId, id);
        const prepared = prepareSchedule(data);
        onScheduleChanged(prepared);
        onLastRangeChanged({ start: prepared.config.startDate, end: prepared.config.endDate });
        await loadShiftRequests(id);
      } catch (e: unknown) {
        onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить график"));
      } finally {
        setScheduleLoading(false);
      }
    },
    [
      loadShiftRequests,
      onAutoTabReset,
      onClearScheduleNotices,
      onLastRangeChanged,
      onScheduleChanged,
      onScheduleError,
      onScheduleReadOnlyChanged,
      prepareSchedule,
      restaurantId,
    ],
  );

  const closeSavedSchedule = React.useCallback(() => {
    onScheduleChanged(null);
    setSelectedSavedId(null);
    onScheduleReadOnlyChanged(false);
    onClearScheduleNotices();
    setScheduleLoading(false);
    onAutoTabReset();
  }, [onAutoTabReset, onClearScheduleNotices, onScheduleChanged, onScheduleReadOnlyChanged]);

  const editSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!restaurantId || !canManage) return;

      onAutoTabReset();
      if (scheduleId === id) {
        setSelectedSavedId(id);
        onScheduleReadOnlyChanged(false);
        onClearScheduleNotices();
        return;
      }

      setSelectedSavedId(id);
      onScheduleReadOnlyChanged(false);
      setScheduleLoading(true);
      onScheduleChanged(null);
      onClearScheduleNotices();
      try {
        const data = await fetchSchedule(restaurantId, id);
        const prepared = prepareSchedule(data);
        onScheduleChanged(prepared);
        onLastRangeChanged({ start: prepared.config.startDate, end: prepared.config.endDate });
        await loadShiftRequests(id);
      } catch (e: unknown) {
        onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить график"));
      } finally {
        setScheduleLoading(false);
      }
    },
    [
      canManage,
      loadShiftRequests,
      onAutoTabReset,
      onClearScheduleNotices,
      onLastRangeChanged,
      onScheduleChanged,
      onScheduleError,
      onScheduleReadOnlyChanged,
      prepareSchedule,
      restaurantId,
      scheduleId,
    ],
  );

  const deleteSavedSchedule = React.useCallback(
    async (id: number) => {
      if (!canManage || !restaurantId) return;
      if (!window.confirm("Удалить этот график? Действие нельзя отменить.")) {
        return;
      }
      setDeletingId(id);
      onClearScheduleNotices();
      try {
        await deleteSchedule(restaurantId, id);
        const savedList = await listSavedSchedules(restaurantId);
        onSavedSchedulesChanged(savedList);
        if (scheduleId === id) {
          onScheduleChanged(null);
          setSelectedSavedId(null);
          onScheduleReadOnlyChanged(false);
        }
        onScheduleMessage("График удалён");
      } catch (e: unknown) {
        onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось удалить график"));
      } finally {
        setDeletingId(null);
      }
    },
    [
      canManage,
      onClearScheduleNotices,
      onSavedSchedulesChanged,
      onScheduleChanged,
      onScheduleError,
      onScheduleMessage,
      onScheduleReadOnlyChanged,
      restaurantId,
      scheduleId,
    ],
  );

  return React.useMemo(
    () => ({
      selectedSavedId,
      scheduleLoading,
      deletingId,
      openSavedSchedule,
      closeSavedSchedule,
      editSavedSchedule,
      deleteSavedSchedule,
    }),
    [
      closeSavedSchedule,
      deleteSavedSchedule,
      deletingId,
      editSavedSchedule,
      openSavedSchedule,
      scheduleLoading,
      selectedSavedId,
    ],
  );
}
