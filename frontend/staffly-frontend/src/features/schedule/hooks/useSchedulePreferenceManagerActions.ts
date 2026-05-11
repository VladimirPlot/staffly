import React from "react";

import {
  getSchedulePreferenceProgress,
  getSchedulePreferenceSubmissions,
  type SchedulePreferenceProgressResponse,
  type SchedulePreferenceSubmissionsResponse,
} from "../api";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type UseSchedulePreferenceManagerActionsParams = {
  restaurantId: number | null;
};

export default function useSchedulePreferenceManagerActions({
  restaurantId,
}: UseSchedulePreferenceManagerActionsParams) {
  const [open, setOpen] = React.useState(false);
  const [scheduleId, setScheduleId] = React.useState<number | null>(null);
  const [progress, setProgress] = React.useState<SchedulePreferenceProgressResponse | null>(null);
  const [submissions, setSubmissions] = React.useState<SchedulePreferenceSubmissionsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOpen(false);
    setScheduleId(null);
    setProgress(null);
    setSubmissions(null);
    setLoading(false);
    setError(null);
  }, [restaurantId]);

  const load = React.useCallback(
    async (targetScheduleId: number) => {
      if (!restaurantId) return;

      setLoading(true);
      setError(null);
      try {
        const [progressData, submissionsData] = await Promise.all([
          getSchedulePreferenceProgress(restaurantId, targetScheduleId),
          getSchedulePreferenceSubmissions(restaurantId, targetScheduleId),
        ]);
        setProgress(progressData);
        setSubmissions(submissionsData);
      } catch (e: unknown) {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить пожелания сотрудников"));
      } finally {
        setLoading(false);
      }
    },
    [restaurantId],
  );

  const openDialog = React.useCallback(
    async (targetScheduleId: number) => {
      if (!restaurantId) return;

      setOpen(true);
      setScheduleId(targetScheduleId);
      setProgress(null);
      setSubmissions(null);
      await load(targetScheduleId);
    },
    [load, restaurantId],
  );

  const closeDialog = React.useCallback(() => {
    setOpen(false);
    setScheduleId(null);
    setProgress(null);
    setSubmissions(null);
    setLoading(false);
    setError(null);
  }, []);

  const reload = React.useCallback(async () => {
    if (!scheduleId) return;
    await load(scheduleId);
  }, [load, scheduleId]);

  return React.useMemo(
    () => ({
      open,
      progress,
      submissions,
      loading,
      error,
      openDialog,
      closeDialog,
      reload,
    }),
    [closeDialog, error, loading, open, openDialog, progress, reload, submissions],
  );
}
