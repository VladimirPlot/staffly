import React from "react";

import {
  getMySchedulePreference,
  upsertMySchedulePreference,
  type SchedulePreferenceMyResponse,
  type UpsertMySchedulePreferenceRequest,
} from "../api";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type UseSchedulePreferenceMeActionsParams = {
  restaurantId: number | null;
  onScheduleChanged: (schedule: null) => void;
  onClearScheduleNotices: () => void;
};

export default function useSchedulePreferenceMeActions({
  restaurantId,
  onScheduleChanged,
  onClearScheduleNotices,
}: UseSchedulePreferenceMeActionsParams) {
  const [preferenceViewScheduleId, setPreferenceViewScheduleId] = React.useState<number | null>(null);
  const [preferenceData, setPreferenceData] = React.useState<SchedulePreferenceMyResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPreferenceViewScheduleId(null);
    setPreferenceData(null);
    setLoading(false);
    setSaving(false);
    setError(null);
    setMessage(null);
  }, [restaurantId]);

  const loadPreference = React.useCallback(
    async (scheduleId: number) => {
      if (!restaurantId) return;

      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const data = await getMySchedulePreference(restaurantId, scheduleId);
        setPreferenceData(data);
      } catch (e: unknown) {
        setPreferenceData(null);
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить пожелания"));
      } finally {
        setLoading(false);
      }
    },
    [restaurantId],
  );

  const openPreferenceView = React.useCallback(
    async (scheduleId: number) => {
      if (!restaurantId) return;

      onScheduleChanged(null);
      onClearScheduleNotices();
      setPreferenceViewScheduleId(scheduleId);
      setPreferenceData(null);
      await loadPreference(scheduleId);
    },
    [loadPreference, onClearScheduleNotices, onScheduleChanged, restaurantId],
  );

  const closePreferenceView = React.useCallback(() => {
    setPreferenceViewScheduleId(null);
    setPreferenceData(null);
    setLoading(false);
    setSaving(false);
    setError(null);
    setMessage(null);
  }, []);

  const submitPreference = React.useCallback(
    async (request: UpsertMySchedulePreferenceRequest) => {
      if (!restaurantId || !preferenceViewScheduleId) return;

      setSaving(true);
      setError(null);
      setMessage(null);
      try {
        const data = await upsertMySchedulePreference(restaurantId, preferenceViewScheduleId, request);
        setPreferenceData(data);
        setMessage("Пожелания отправлены");
      } catch (e: unknown) {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось отправить пожелания"));
      } finally {
        setSaving(false);
      }
    },
    [preferenceViewScheduleId, restaurantId],
  );

  return React.useMemo(
    () => ({
      preferenceViewScheduleId,
      preferenceData,
      loading,
      saving,
      error,
      message,
      openPreferenceView,
      closePreferenceView,
      submitPreference,
    }),
    [
      closePreferenceView,
      error,
      loading,
      message,
      openPreferenceView,
      preferenceData,
      preferenceViewScheduleId,
      saving,
      submitPreference,
    ],
  );
}
