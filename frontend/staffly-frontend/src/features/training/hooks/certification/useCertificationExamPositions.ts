import { useCallback, useEffect, useRef, useState } from "react";
import { getCertificationExamPositions } from "../../api/trainingApi";
import type { CertificationExamPositionBreakdownDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationExamPositions(restaurantId: number | null, examId: number | null) {
  const [positions, setPositions] = useState<CertificationExamPositionBreakdownDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!restaurantId || !examId) {
      requestIdRef.current += 1;
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setPositions([]);
    setLoading(true);
    setError(null);
    try {
      const nextPositions = await getCertificationExamPositions(restaurantId, examId);
      if (requestId !== requestIdRef.current) return;
      setPositions(nextPositions);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setPositions([]);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить статистику по должностям."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { positions, loading, error, reload };
}
