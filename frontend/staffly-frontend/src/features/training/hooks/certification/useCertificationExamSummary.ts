import { useCallback, useEffect, useRef, useState } from "react";
import { getCertificationExamSummary } from "../../api/trainingApi";
import type { CertificationExamSummaryDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationExamSummary(restaurantId: number | null, examId: number | null) {
  const [summary, setSummary] = useState<CertificationExamSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!restaurantId || !examId) {
      requestIdRef.current += 1;
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setSummary(null);
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await getCertificationExamSummary(restaurantId, examId);
      if (requestId !== requestIdRef.current) return;
      setSummary(nextSummary);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setSummary(null);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить сводку по аттестации."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, examId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { summary, loading, error, reload };
}
