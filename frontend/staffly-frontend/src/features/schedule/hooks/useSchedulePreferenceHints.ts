import React from "react";

import { getSchedulePreferenceSubmissions, type SchedulePreferenceSubmissionsResponse } from "../api";

type Params = { restaurantId: number | null; scheduleId: number | null; enabled: boolean };

export default function useSchedulePreferenceHints({ restaurantId, scheduleId, enabled }: Params) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submissions, setSubmissions] = React.useState<SchedulePreferenceSubmissionsResponse | null>(null);

  const reload = React.useCallback(async () => {
    if (!enabled || !restaurantId || !scheduleId) {
      setLoading(false);
      setError(null);
      setSubmissions(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSchedulePreferenceSubmissions(restaurantId, scheduleId);
      setSubmissions(data);
    } catch {
      setError("Не удалось загрузить пожелания сотрудников");
      setSubmissions(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, restaurantId, scheduleId]);

  React.useEffect(() => {
    if (!enabled || !restaurantId || !scheduleId) {
      setLoading(false);
      setError(null);
      setSubmissions(null);
      return;
    }
    void reload();
  }, [enabled, restaurantId, scheduleId, reload]);

  return { loading, error, submissions, reload };
}
