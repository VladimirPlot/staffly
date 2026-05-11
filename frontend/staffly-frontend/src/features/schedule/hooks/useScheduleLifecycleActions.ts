import React from "react";

import {
  closePreferenceCollection,
  listSavedSchedules,
  publishSchedule,
  startPreferenceCollection,
  type ScheduleSummary,
} from "../api";
import type { ScheduleData } from "../types";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type ScheduleRange = { start: string; end: string } | null;
type LifecycleAction = "startPreferences" | "closePreferences" | "publish";

type UseScheduleLifecycleActionsParams = {
  restaurantId: number | null;
  canManage: boolean;
  schedule: ScheduleData | null;
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  onScheduleChanged: (schedule: ScheduleData | null) => void;
  onSavedSchedulesChanged: (items: ScheduleSummary[]) => void;
  onScheduleReadOnlyChanged: (value: boolean) => void;
  onLastRangeChanged: (value: ScheduleRange) => void;
  onClearScheduleNotices: () => void;
  onScheduleMessage: (message: string) => void;
  onScheduleError: (message: string | null) => void;
};

export default function useScheduleLifecycleActions({
  restaurantId,
  canManage,
  schedule,
  prepareSchedule,
  onScheduleChanged,
  onSavedSchedulesChanged,
  onScheduleReadOnlyChanged,
  onLastRangeChanged,
  onClearScheduleNotices,
  onScheduleMessage,
  onScheduleError,
}: UseScheduleLifecycleActionsParams) {
  const [preferenceDialogOpen, setPreferenceDialogOpen] = React.useState(false);
  const [preferenceDeadline, setPreferenceDeadline] = React.useState("");
  const [preferenceDeadlineError, setPreferenceDeadlineError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<LifecycleAction | null>(null);

  React.useEffect(() => {
    if (!canManage) {
      setPreferenceDialogOpen(false);
      setPreferenceDeadline("");
      setPreferenceDeadlineError(null);
      setPendingAction(null);
    }
  }, [canManage]);

  React.useEffect(() => {
    setPreferenceDialogOpen(false);
    setPreferenceDeadline("");
    setPreferenceDeadlineError(null);
    setPendingAction(null);
  }, [restaurantId]);

  const applyUpdatedSchedule = React.useCallback(
    async (updatedSchedule: ScheduleData) => {
      const prepared = prepareSchedule(updatedSchedule);
      onScheduleChanged(prepared);
      onScheduleReadOnlyChanged(true);
      onLastRangeChanged({ start: prepared.config.startDate, end: prepared.config.endDate });
      if (restaurantId) {
        const savedList = await listSavedSchedules(restaurantId);
        onSavedSchedulesChanged(savedList);
      }
    },
    [
      onLastRangeChanged,
      onSavedSchedulesChanged,
      onScheduleChanged,
      onScheduleReadOnlyChanged,
      prepareSchedule,
      restaurantId,
    ],
  );

  const closePreferenceDialog = React.useCallback(() => {
    if (pendingAction === "startPreferences") return;
    setPreferenceDialogOpen(false);
    setPreferenceDeadline("");
    setPreferenceDeadlineError(null);
  }, [pendingAction]);

  const openPreferenceDialog = React.useCallback(() => {
    if (!canManage) return;
    setPreferenceDeadline("");
    setPreferenceDeadlineError(null);
    setPreferenceDialogOpen(true);
  }, [canManage]);

  const submitPreferenceCollection = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule?.id) return;
    if (!preferenceDeadline) {
      setPreferenceDeadlineError("Укажите дедлайн сбора пожеланий");
      return;
    }

    const parsedDeadline = new Date(preferenceDeadline);
    if (Number.isNaN(parsedDeadline.getTime())) {
      setPreferenceDeadlineError("Укажите корректные дату и время");
      return;
    }

    setPendingAction("startPreferences");
    setPreferenceDeadlineError(null);
    onClearScheduleNotices();
    try {
      const updatedSchedule = await startPreferenceCollection(restaurantId, schedule.id, {
        preferenceDeadline: parsedDeadline.toISOString(),
      });
      await applyUpdatedSchedule(updatedSchedule);
      setPreferenceDialogOpen(false);
      setPreferenceDeadline("");
      onScheduleMessage("Сбор пожеланий запущен");
    } catch (e: unknown) {
      onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось запустить сбор пожеланий"));
    } finally {
      setPendingAction(null);
    }
  }, [
    applyUpdatedSchedule,
    canManage,
    onClearScheduleNotices,
    onScheduleError,
    onScheduleMessage,
    preferenceDeadline,
    restaurantId,
    schedule?.id,
  ]);

  const closePreferenceCollectionAction = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule?.id) return;
    setPendingAction("closePreferences");
    onClearScheduleNotices();
    try {
      const updatedSchedule = await closePreferenceCollection(restaurantId, schedule.id);
      await applyUpdatedSchedule(updatedSchedule);
      onScheduleMessage("Сбор пожеланий закрыт");
    } catch (e: unknown) {
      onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось закрыть сбор пожеланий"));
    } finally {
      setPendingAction(null);
    }
  }, [
    applyUpdatedSchedule,
    canManage,
    onClearScheduleNotices,
    onScheduleError,
    onScheduleMessage,
    restaurantId,
    schedule?.id,
  ]);

  const publishScheduleAction = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule?.id) return;
    setPendingAction("publish");
    onClearScheduleNotices();
    try {
      const updatedSchedule = await publishSchedule(restaurantId, schedule.id);
      await applyUpdatedSchedule(updatedSchedule);
      onScheduleMessage("График опубликован");
    } catch (e: unknown) {
      onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось опубликовать график"));
    } finally {
      setPendingAction(null);
    }
  }, [
    applyUpdatedSchedule,
    canManage,
    onClearScheduleNotices,
    onScheduleError,
    onScheduleMessage,
    restaurantId,
    schedule?.id,
  ]);

  return React.useMemo(
    () => ({
      preferenceDialogOpen,
      preferenceDeadline,
      preferenceDeadlineError,
      pendingAction,
      setPreferenceDeadline,
      openPreferenceDialog,
      closePreferenceDialog,
      submitPreferenceCollection,
      closePreferenceCollection: closePreferenceCollectionAction,
      publishSchedule: publishScheduleAction,
    }),
    [
      closePreferenceCollectionAction,
      closePreferenceDialog,
      openPreferenceDialog,
      pendingAction,
      preferenceDeadline,
      preferenceDeadlineError,
      preferenceDialogOpen,
      publishScheduleAction,
      submitPreferenceCollection,
    ],
  );
}
