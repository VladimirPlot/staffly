import { useCallback, useEffect, useRef, useState } from "react";
import { getCertificationEmployeeSummary } from "../../api/trainingApi";
import type { CertificationEmployeeSummaryDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationEmployeeSummary(
  restaurantId: number | null,
  userId: number | null,
) {
  const [summary, setSummary] = useState<CertificationEmployeeSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!restaurantId || !userId) {
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
      const response = await getCertificationEmployeeSummary(restaurantId, userId);
      if (requestId !== requestIdRef.current) return;
      setSummary(response);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setSummary(null);
      setError(getTrainingErrorMessage(e, "Не удалось загрузить сводку по сотруднику."));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    summary,
    loading,
    error,
    reload,
  };
}
