import React from "react";

import { previewScheduleAutoBuild, type ScheduleAutoBuildPreviewResponse } from "../api";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

export default function useScheduleAutoBuildPreviewActions(restaurantId: number | null, scheduleId: number | null) {
  const [preview, setPreview] = React.useState<ScheduleAutoBuildPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPreview(null);
    setLoading(false);
    setError(null);
  }, [restaurantId, scheduleId]);

  const clearPreview = React.useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  const loadPreview = React.useCallback(
    async (templateId: number): Promise<boolean> => {
      if (!restaurantId || !scheduleId) return false;
      setLoading(true);
      setError(null);
      try {
        const response = await previewScheduleAutoBuild(restaurantId, scheduleId, { templateId });
        setPreview(response);
        return true;
      } catch (e: unknown) {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось построить предварительный график"));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [restaurantId, scheduleId],
  );

  return React.useMemo(
    () => ({
      preview,
      loading,
      error,
      loadPreview,
      clearPreview,
    }),
    [clearPreview, error, loadPreview, loading, preview],
  );
}
