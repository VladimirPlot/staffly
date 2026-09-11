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
  onPreferenceSubmitted?: () => void | Promise<void>;
};

export default function useSchedulePreferenceMeActions({
  restaurantId,
  onScheduleChanged,
  onClearScheduleNotices,
  onPreferenceSubmitted,
}: UseSchedulePreferenceMeActionsParams) {
  const [preferenceViewScheduleId, setPreferenceViewScheduleId] = React.useState<number | null>(null);
  const [preferenceData, setPreferenceData] = React.useState<SchedulePreferenceMyResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const requestSequenceRef = React.useRef(0);

  React.useEffect(() => {
    requestSequenceRef.current += 1;
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
      const requestSequence = ++requestSequenceRef.current;

      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const data = await getMySchedulePreference(restaurantId, scheduleId);
        if (requestSequence !== requestSequenceRef.current) return;
        setPreferenceData(data);
      } catch (e: unknown) {
        if (requestSequence !== requestSequenceRef.current) return;
        setPreferenceData(null);
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить пожелания"));
      } finally {
        if (requestSequence === requestSequenceRef.current) setLoading(false);
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
    requestSequenceRef.current += 1;
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
      const requestSequence = ++requestSequenceRef.current;

      setSaving(true);
      setError(null);
      setMessage(null);
      try {
        const data = await upsertMySchedulePreference(restaurantId, preferenceViewScheduleId, request);
        if (requestSequence !== requestSequenceRef.current) return;
        setPreferenceData(data);
        setMessage("Пожелания отправлены");
        try {
          await onPreferenceSubmitted?.();
        } catch (reloadError: unknown) {
          if (requestSequence !== requestSequenceRef.current) return;
          setError(
            getFriendlyScheduleErrorMessage(
              reloadError,
              "Пожелания отправлены, но не удалось обновить список графиков",
            ),
          );
        }
      } catch (e: unknown) {
        if (requestSequence !== requestSequenceRef.current) return;
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось отправить пожелания"));
      } finally {
        if (requestSequence === requestSequenceRef.current) setSaving(false);
      }
    },
    [onPreferenceSubmitted, preferenceViewScheduleId, restaurantId],
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
