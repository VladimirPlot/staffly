import React from "react";

import {
  applySchedulePreferencesSimple,
  closePreferenceCollection,
  listSavedSchedules,
  publishSchedule,
  startPreferenceCollection,
  type ScheduleSummary,
} from "../api";
import type { EditableScheduleData, ScheduleData } from "../types";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";
import { restaurantLocalDateTimeToInstant } from "../utils/date";

type ScheduleRange = { start: string; end: string } | null;
type LifecycleAction = "startPreferences" | "closePreferences" | "applyPreferences" | "publish";

type UseScheduleLifecycleActionsParams = {
  restaurantId: number | null;
  restaurantTimeZone: string;
  canManage: boolean;
  schedule: EditableScheduleData | null;
  prepareSchedule: (schedule: ScheduleData) => ScheduleData;
  onScheduleChanged: (schedule: EditableScheduleData | null) => void;
  onSavedSchedulesChanged: (items: ScheduleSummary[]) => void;
  onScheduleReadOnlyChanged: (value: boolean) => void;
  onLastRangeChanged: (value: ScheduleRange) => void;
  onClearScheduleNotices: () => void;
  onScheduleMessage: (message: string) => void;
  onScheduleError: (message: string | null) => void;
};

export default function useScheduleLifecycleActions({
  restaurantId,
  restaurantTimeZone,
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
  const [preferenceCollectionMode, setPreferenceCollectionMode] = React.useState<"DAY_LEVEL" | "SHIFT_OPTIONS">("DAY_LEVEL");
  const [preferenceBuildTemplateId, setPreferenceBuildTemplateIdValue] = React.useState("");
  const [preferenceDeadlineError, setPreferenceDeadlineError] = React.useState<string | null>(null);
  const [preferenceBuildTemplateError, setPreferenceBuildTemplateError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<LifecycleAction | null>(null);
  const activeScheduleIdRef = React.useRef(schedule?.id);
  activeScheduleIdRef.current = schedule?.id;

  React.useEffect(() => {
    if (!canManage) {
      setPreferenceDialogOpen(false);
      setPreferenceDeadline("");
      setPreferenceCollectionMode("DAY_LEVEL");
      setPreferenceBuildTemplateIdValue("");
      setPreferenceDeadlineError(null);
      setPreferenceBuildTemplateError(null);
      setPendingAction(null);
    }
  }, [canManage]);

  React.useEffect(() => {
    setPreferenceDialogOpen(false);
    setPreferenceDeadline("");
    setPreferenceCollectionMode("DAY_LEVEL");
    setPreferenceBuildTemplateIdValue("");
    setPreferenceDeadlineError(null);
    setPreferenceBuildTemplateError(null);
    setPendingAction(null);
  }, [restaurantId]);

  const applyUpdatedSchedule = React.useCallback(
    async (updatedSchedule: ScheduleData) => {
      if (updatedSchedule.id !== activeScheduleIdRef.current) return;
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
    setPreferenceCollectionMode("DAY_LEVEL");
    setPreferenceBuildTemplateIdValue("");
    setPreferenceDeadlineError(null);
    setPreferenceBuildTemplateError(null);
  }, [pendingAction]);

  const openPreferenceDialog = React.useCallback(() => {
    if (!canManage) return;
    setPreferenceDeadline("");
    setPreferenceCollectionMode("DAY_LEVEL");
    setPreferenceBuildTemplateIdValue("");
    setPreferenceDeadlineError(null);
    setPreferenceBuildTemplateError(null);
    setPreferenceDialogOpen(true);
  }, [canManage]);

  const setPreferenceBuildTemplateId = React.useCallback((value: string) => {
    setPreferenceBuildTemplateIdValue(value);
    setPreferenceBuildTemplateError(null);
  }, []);

  const submitPreferenceCollection = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule?.id || schedule.version == null) return false;
    if (!preferenceDeadline) {
      setPreferenceDeadlineError("Укажите дедлайн сбора пожеланий");
      return;
    }
    if (preferenceCollectionMode === "SHIFT_OPTIONS" && !preferenceBuildTemplateId) {
      setPreferenceBuildTemplateError("Выберите шаблон сборки");
      return;
    }

    const deadlineInstant = restaurantLocalDateTimeToInstant(preferenceDeadline, restaurantTimeZone);
    if (!deadlineInstant) {
      setPreferenceDeadlineError("Укажите корректные дату и время");
      return;
    }

    setPendingAction("startPreferences");
    setPreferenceDeadlineError(null);
    onClearScheduleNotices();
    try {
      const parsedBuildTemplateId = preferenceCollectionMode === "SHIFT_OPTIONS"
        ? Number(preferenceBuildTemplateId)
        : null;
      if (preferenceCollectionMode === "SHIFT_OPTIONS" && !Number.isFinite(parsedBuildTemplateId)) {
        setPreferenceBuildTemplateError("Выберите шаблон сборки");
        return;
      }
      const updatedSchedule = await startPreferenceCollection(restaurantId, schedule.id, {
        version: schedule.version,
        preferenceDeadline: deadlineInstant,
        mode: preferenceCollectionMode,
        buildTemplateId: parsedBuildTemplateId,
      });
      await applyUpdatedSchedule(updatedSchedule);
      setPreferenceDialogOpen(false);
      setPreferenceDeadline("");
      setPreferenceCollectionMode("DAY_LEVEL");
      setPreferenceBuildTemplateIdValue("");
      setPreferenceBuildTemplateError(null);
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
    preferenceBuildTemplateId,
    preferenceCollectionMode,
    preferenceDeadline,
    restaurantId,
    restaurantTimeZone,
    schedule?.id,
    schedule?.version,
  ]);

  const closePreferenceCollectionAction = React.useCallback(async () => {
    if (!canManage || !restaurantId || !schedule?.id || schedule.version == null) return false;
    setPendingAction("closePreferences");
    onClearScheduleNotices();
    try {
      const updatedSchedule = await closePreferenceCollection(restaurantId, schedule.id, schedule.version);
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
    schedule?.version,
  ]);

  const applyPreferencesSimpleAction = React.useCallback(async (): Promise<boolean> => {
    if (!canManage || !restaurantId || !schedule?.id || schedule.version == null) return false;
    setPendingAction("applyPreferences");
    onClearScheduleNotices();
    try {
      const updatedSchedule = await applySchedulePreferencesSimple(restaurantId, schedule.id, schedule.version);
      await applyUpdatedSchedule(updatedSchedule);
      onScheduleMessage("Черновик готов к ручной сборке");
      return true;
    } catch (e: unknown) {
      onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось подготовить черновик"));
      return false;
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
    schedule?.version,
  ]);

  const publishScheduleAction = React.useCallback(async (): Promise<boolean> => {
    if (!canManage || !restaurantId || !schedule?.id || schedule.version == null) return false;
    setPendingAction("publish");
    onClearScheduleNotices();
    try {
      const updatedSchedule = await publishSchedule(restaurantId, schedule.id, schedule.version);
      await applyUpdatedSchedule(updatedSchedule);
      onScheduleMessage("График опубликован");
      return true;
    } catch (e: unknown) {
      onScheduleError(getFriendlyScheduleErrorMessage(e, "Не удалось опубликовать график"));
      return false;
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
    schedule?.version,
  ]);

  return React.useMemo(
    () => ({
      preferenceDialogOpen,
      preferenceDeadline,
      preferenceCollectionMode,
      preferenceBuildTemplateId,
      preferenceDeadlineError,
      preferenceBuildTemplateError,
      pendingAction,
      setPreferenceDeadline,
      setPreferenceCollectionMode,
      setPreferenceBuildTemplateId,
      openPreferenceDialog,
      closePreferenceDialog,
      submitPreferenceCollection,
      closePreferenceCollection: closePreferenceCollectionAction,
      applyPreferencesSimple: applyPreferencesSimpleAction,
      publishSchedule: publishScheduleAction,
    }),
    [
      applyPreferencesSimpleAction,
      closePreferenceCollectionAction,
      closePreferenceDialog,
      openPreferenceDialog,
      pendingAction,
      preferenceBuildTemplateId,
      preferenceCollectionMode,
      preferenceBuildTemplateError,
      preferenceDeadline,
      preferenceDeadlineError,
      preferenceDialogOpen,
      publishScheduleAction,
      setPreferenceBuildTemplateId,
      setPreferenceCollectionMode,
      submitPreferenceCollection,
    ],
  );
}
