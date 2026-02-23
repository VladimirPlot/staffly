import { useCallback, useEffect, useMemo, useState } from "react";
import { getExamProgress } from "../api/trainingApi";
import type { ExamProgressDto } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";

export function useExamProgress(restaurantId: number | null) {
  const [progress, setProgress] = useState<ExamProgressDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getExamProgress(restaurantId);
      setProgress(response);
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось загрузить прогресс аттестаций."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const progressByExamId = useMemo(() => {
    return new Map(progress.map((item) => [item.examId, item]));
  }, [progress]);

  return { progress, progressByExamId, loading, error, reload };
}
