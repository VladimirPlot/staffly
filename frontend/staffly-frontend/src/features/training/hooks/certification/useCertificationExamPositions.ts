import { useCallback, useEffect, useState } from "react";
import { getCertificationExamPositions } from "../../api/trainingApi";
import type { CertificationExamPositionBreakdownDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationExamPositions(restaurantId: number | null, examId: number | null) {
  const [positions, setPositions] = useState<CertificationExamPositionBreakdownDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId || !examId) {
      setPositions([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setPositions(await getCertificationExamPositions(restaurantId, examId));
    } catch (e) {
      setPositions([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить статистику по должностям."));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { positions, loading, error, reload };
}
